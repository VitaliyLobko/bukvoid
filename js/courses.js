// Курси — дані, не код: теорія блоками, приклади, тести, друк, посилання. Формат «bukvoid-course» v1 (див. README).
// Встановлені курси лежать в IndexedDB (localStorage на github.io спільний з іншими застосунками й малий).
// Каталог — courses/index.json у репо; курс із файлу живе лише на цьому пристрої.

import { ICONS } from './icons.js';

const DB_NAME = 'bukvoid-courses';
const STORE = 'packs';
const CATALOG_URL = './courses/index.json';
// Ставляться самі, доки людина їх не видалила (видалення пам'ятає цей пристрій)
const DEFAULTS = ['uk-pravopys', 'en-a2', 'en-b1'];
const REMOVED_KEY = 'bukvoid:courses-removed';
const MAX_UNITS = 200;
const MAX_BYTES = 3_000_000;

export const FORMAT = 'bukvoid-course';
const ID_RE = /^[a-z0-9][a-z0-9-]{1,39}$/;
const BLOCKS = ['h', 'p', 'ul', 'tip', 'warn', 'table'];
const TYPES = ['choice', 'gap', 'fix', 'translate'];

/** Помилки формату: [] — курс годиться. Повідомлення — людською мовою, з місцем помилки. */
export function validate(pack) {
  const err = [];
  const str = (v) => typeof v === 'string' && v.trim().length > 0;
  if (!pack || typeof pack !== 'object') return ['Це не курс: файл не містить об\'єкта JSON.'];
  if (pack.format !== FORMAT) err.push(`Поле format має бути «${FORMAT}».`);
  if (pack.v !== 1) err.push('Поле v має бути 1 (версія формату).');
  if (!ID_RE.test(pack.id ?? '')) err.push('id курсу — латиниця, цифри й дефіс, 2–40 знаків (напр. geometry-8).');
  if (!str(pack.title)) err.push('Немає назви курсу (title).');
  if (pack.lang && !['uk', 'en'].includes(pack.lang)) err.push('lang — uk або en (мова друку в курсі).');
  if (pack.icon !== undefined && !ICONS.includes(pack.icon)) err.push(`icon — один зі значків: ${ICONS.join(', ')}.`);
  if (pack.pass !== undefined && !(typeof pack.pass === 'number' && pack.pass > 0 && pack.pass <= 1)) err.push('pass — частка правильних для «пройдено», від 0 до 1 (напр. 0.8).');
  if (!Array.isArray(pack.units) || !pack.units.length) err.push('Немає юнітів (units).');
  else if (pack.units.length > MAX_UNITS) err.push(`Забагато юнітів: ${pack.units.length}, можна до ${MAX_UNITS}.`);
  const ids = new Set();
  (Array.isArray(pack.units) ? pack.units : []).forEach((u, i) => {
    const at = `Юніт ${i + 1}${u?.title ? ` «${u.title}»` : ''}`;
    if (!u || typeof u !== 'object') { err.push(`${at}: не об'єкт.`); return; }
    if (!ID_RE.test(u.id ?? '')) err.push(`${at}: id — латиниця, цифри й дефіс.`);
    else if (ids.has(u.id)) err.push(`${at}: id «${u.id}» повторюється.`);
    ids.add(u.id);
    if (!str(u.title)) err.push(`${at}: немає назви.`);
    if (!Array.isArray(u.theory)) err.push(`${at}: theory має бути списком блоків.`);
    else u.theory.forEach((b, k) => {
      const key = b && Object.keys(b).find((x) => BLOCKS.includes(x));
      if (!key) err.push(`${at}, теорія ${k + 1}: блок має бути одним із ${BLOCKS.join(', ')}.`);
      else if (key === 'ul' && !(Array.isArray(b.ul) && b.ul.every(str))) err.push(`${at}, теорія ${k + 1}: ul — список рядків.`);
      else if (key === 'table' && !(Array.isArray(b.table) && b.table.length > 1 && b.table.every((r) => Array.isArray(r) && r.every((c) => typeof c === 'string')))) err.push(`${at}, теорія ${k + 1}: table — рядки з комірок-рядків, перший — заголовок.`);
      else if (!['ul', 'table'].includes(key) && !str(b[key])) err.push(`${at}, теорія ${k + 1}: порожній текст.`);
    });
    if (u.examples && !(Array.isArray(u.examples) && u.examples.every((x) => str(x) || (x && (str(x.w) || (str(x.en) && str(x.uk))))))) err.push(`${at}: examples — рядки, {w, note} або {en, uk}.`);
    if (u.words && !(Array.isArray(u.words) && u.words.every((w) => w && str(w.en) && str(w.uk) && (w.ex === undefined || str(w.ex))))) err.push(`${at}: words — фрази {en, uk, ex?} для повторення.`);
    if (u.typing && !(Array.isArray(u.typing) && u.typing.every(str))) err.push(`${at}: typing — список речень.`);
    if (u.media && !(Array.isArray(u.media) && u.media.every((m) => m && str(m.title) && /^https:\/\//.test(m.url ?? '')))) err.push(`${at}: media — {title, url https://…}.`);
    if (!Array.isArray(u.exercises)) err.push(`${at}: exercises має бути списком.`);
    else u.exercises.forEach((e, k) => {
      const ex = `${at}, вправа ${k + 1}`;
      if (!e || !TYPES.includes(e.type)) { err.push(`${ex}: type — ${TYPES.join(', ')}.`); return; }
      if (!str(e.q)) err.push(`${ex}: немає питання (q).`);
      if (e.type === 'choice') {
        if (!(Array.isArray(e.options) && e.options.length >= 2 && e.options.every(str))) err.push(`${ex}: options — щонайменше 2 варіанти.`);
        else if (!(Number.isInteger(e.a) && e.a >= 0 && e.a < e.options.length)) err.push(`${ex}: a — номер правильного варіанта від 0.`);
      } else if (!(Array.isArray(e.a) && e.a.length && e.a.every(str))) err.push(`${ex}: a — список правильних відповідей.`);
    });
  });
  return err;
}

// ---------- IndexedDB ----------

let dbp = null;
function db() {
  dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

async function tx(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(out?.result ?? out);
    t.onerror = () => reject(t.error);
  });
}

// ---------- встановлені курси (у пам'яті — для малювання без очікування) ----------

const installed = new Map();
let catalogCache = null;

export const list = () => [...installed.values()].sort((a, b) => (a.added || 0) - (b.added || 0));
export const enabled = () => list().filter((x) => x.enabled);
export const get = (id) => installed.get(id)?.pack ?? null;
export const unit = (cid, uid) => get(cid)?.units.find((u) => u.id === uid) ?? null;

// Вбудовані курси без файлу (друк — уроки з розкладки): лише «показувати чи ні», видалити не можна.
// Російську розкладку типово сховано — російського курсу користувач не хоче, а друк лишається доступним.
const OFF_KEY = 'bukvoid:courses-off';
function off() {
  try { const raw = localStorage.getItem(OFF_KEY); return new Set(raw ? JSON.parse(raw) : ['druk-ru']); } catch { return new Set(['druk-ru']); }
}
export const builtinOn = (id) => !off().has(id);
export function setBuiltin(id, on) {
  const ids = off();
  if (on) ids.delete(id); else ids.add(id);
  try { localStorage.setItem(OFF_KEY, JSON.stringify([...ids])); } catch { /* приватний режим */ }
  window.dispatchEvent(new Event('courses-change'));
}

/** Курси, які людина видалила на цьому пристрої: самі вже не ставляться, навіть якщо є прогрес. */
function removed() {
  try { return new Set(JSON.parse(localStorage.getItem(REMOVED_KEY) || '[]')); } catch { return new Set(); }
}
function markRemoved(id, on) {
  const ids = removed();
  if (on) ids.add(id); else ids.delete(id);
  try { localStorage.setItem(REMOVED_KEY, JSON.stringify([...ids])); } catch { /* приватний режим */ }
}

async function put(rec) {
  markRemoved(rec.id, false);
  await tx('readwrite', (s) => s.put(rec));
  installed.set(rec.id, rec);
  window.dispatchEvent(new Event('courses-change'));
}

/** Каталог з репо: мережа, без неї — копія service worker. null — недоступний. */
export async function catalog() {
  try {
    const res = await fetch(CATALOG_URL, { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    catalogCache = Array.isArray(data?.courses) ? data.courses : [];
  } catch { /* офлайн — що вже знаємо */ }
  return catalogCache;
}

async function fetchPack(entry) {
  const res = await fetch(`./courses/${entry.file}`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Курс не завантажився (HTTP ${res.status})`);
  return res.json();
}

/** Встановити з каталогу (або оновити, якщо там новіша версія). */
export async function install(id) {
  const entry = (catalogCache ?? await catalog() ?? []).find((c) => c.id === id);
  if (!entry) throw new Error('Цього курсу немає в каталозі');
  const pack = await fetchPack(entry);
  const errors = validate(pack);
  if (errors.length) throw new Error(errors[0]);
  const prev = installed.get(id);
  await put({ id, pack, from: 'catalog', enabled: prev?.enabled ?? true, added: prev?.added ?? Date.now() });
}

/** Курс із файлу: перевірка формату; той самий id — заміна (прогрес лишається, він за id юнітів). */
export async function importFile(text) {
  if (text.length > MAX_BYTES) throw Object.assign(new Error('Файл завеликий для курсу (до 3 МБ).'), { errors: [] });
  let pack;
  try { pack = JSON.parse(text); } catch { throw Object.assign(new Error('Це не JSON — файл курсу має бути .json.'), { errors: [] }); }
  const errors = validate(pack);
  if (errors.length) throw Object.assign(new Error('Файл не схожий на курс Буквоїда.'), { errors });
  const prev = installed.get(pack.id);
  await put({ id: pack.id, pack, from: 'file', enabled: true, added: prev?.added ?? Date.now() });
  return pack;
}

export async function setEnabled(id, on) {
  const rec = installed.get(id);
  if (rec) await put({ ...rec, enabled: on });
}

export async function remove(id) {
  markRemoved(id, true);
  await tx('readwrite', (s) => s.delete(id));
  installed.delete(id);
  window.dispatchEvent(new Event('courses-change'));
}

/**
 * Перед першим екраном: встановлені — в пам'ять, курси за замовчуванням, яких бракує, — ставляться
 * (на 0.1.4 стояв лише правопис — англійська з'являється сама).
 * Далі, у фоні: курси каталогу з новішою версією оновлюються, а ті, де є прогрес з іншого пристрою, — ставляться.
 */
export async function ready() {
  try {
    const all = await tx('readonly', (s) => s.getAll());
    for (const rec of all ?? []) installed.set(rec.id, rec);
  } catch { /* IndexedDB недоступна (приватний режим) — курси підтягнуться з мережі */ }
  const skip = removed();
  for (const id of DEFAULTS) if (!installed.has(id) && !skip.has(id)) await install(id).catch(() => {});
}

/** Фоново: новіші версії з каталогу; вбудовані й ті, по яких є прогрес з іншого пристрою, — якщо їх тут не видаляли. */
export async function refresh(progressIds = []) {
  const cat = await catalog();
  if (!cat) return;
  const skip = removed();
  for (const c of cat) {
    const rec = installed.get(c.id);
    const stale = rec?.from === 'catalog' && (rec.pack.version || 0) < (c.version || 0);
    const wanted = !rec && !skip.has(c.id) && (c.builtIn || progressIds.includes(c.id));
    if (stale || wanted) await install(c.id).catch(() => {});
  }
}
