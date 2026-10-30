// Курси — дані, не код: теорія блоками, приклади, тести, друк, посилання. Формат «bukvoid-course» v1 (див. README).
// Встановлені курси лежать в IndexedDB (localStorage на github.io спільний з іншими застосунками й малий).
// Каталог — courses/index.json у репо; курс із файлу живе лише на цьому пристрої.
// Курс із картинками — пакет: у каталозі папка (course.json + img/…), файлом — .zip з тим самим.
// Картинки зберігаються разом із курсом в IndexedDB — курс працює без мережі.

import { ICONS } from './icons.js';
import { unzip } from './zip.js';

const DB_NAME = 'bukvoid-courses';
const STORE = 'packs';
const CATALOG_URL = './courses/index.json';
// Ставляться самі, доки людина їх не видалила (видалення пам'ятає цей пристрій)
const DEFAULTS = ['uk-pravopys', 'en-a2', 'en-b1'];
const REMOVED_KEY = 'bukvoid:courses-removed';
const MAX_UNITS = 200;
const MAX_BYTES = 3_000_000;
const MAX_IMAGE = 1_000_000;
const MAX_PACKAGE = 15_000_000;
// Шлях картинки в пакеті: без «..», без адрес і абсолютних шляхів — лише файли самого курсу
const ASSET_RE = /^(?!.*\.\.)(?!.*\/\/)[a-z0-9][a-z0-9._/-]*\.(png|jpe?g|webp|gif|svg)$/i;
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml' };
const HEX_RE = /^#[0-9a-f]{6}$/i;
const mimeOf = (path) => MIME[path.split('.').pop().toLowerCase()];
export const isAsset = (path) => ASSET_RE.test(path);

export const FORMAT = 'bukvoid-course';
const ID_RE = /^[a-z0-9][a-z0-9-]{1,39}$/;
const BLOCKS = ['h', 'p', 'ul', 'tip', 'warn', 'table', 'img', 'swatches', 'contrast'];
const TYPES = ['choice', 'gap', 'fix', 'translate', 'number', 'order', 'spot'];

/** Усі картинки, на які посилається курс: блоки img теорії й вправи з img. */
export function assetsOf(pack) {
  const out = new Set();
  for (const u of Array.isArray(pack?.units) ? pack.units : []) {
    for (const b of Array.isArray(u?.theory) ? u.theory : []) if (typeof b?.img === 'string') out.add(b.img);
    for (const e of Array.isArray(u?.exercises) ? u.exercises : []) if (typeof e?.img === 'string') out.add(e.img);
  }
  return out;
}

/** SVG зі скриптом чи обробником подій: у <img> він не виконається, але відкритий окремо — так. Не приймаємо. */
export const unsafeSvg = (text) => /<script|<foreignObject|\bon[a-z]+\s*=|javascript:|<iframe|<object|<embed/i.test(text);

/**
 * Помилки формату: [] — курс годиться. Повідомлення — людською мовою, з місцем помилки.
 * files — шляхи картинок, що є в пакеті: кожна картинка курсу має там бути.
 */
export function validate(pack, files = new Set()) {
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
      else if (key === 'img') {
        if (!ASSET_RE.test(b.img)) err.push(`${at}, теорія ${k + 1}: img — шлях до картинки в курсі (img/назва.png, .jpg, .webp, .svg).`);
        if (!str(b.alt)) err.push(`${at}, теорія ${k + 1}: у картинки має бути alt — що на ній, для тих, хто її не бачить.`);
      } else if (key === 'swatches' && !(Array.isArray(b.swatches) && b.swatches.length && b.swatches.length <= 12 && b.swatches.every((c) => c && HEX_RE.test(c.hex ?? '')))) {
        err.push(`${at}, теорія ${k + 1}: swatches — до 12 кольорів {hex: "#1e88e5", name, note}.`);
      } else if (key === 'contrast' && !(Array.isArray(b.contrast) && b.contrast.length && b.contrast.length <= 8 && b.contrast.every((c) => c && HEX_RE.test(c.fg ?? '') && HEX_RE.test(c.bg ?? '')))) {
        err.push(`${at}, теорія ${k + 1}: contrast — до 8 пар {fg: "#000000", bg: "#ffffff", text}.`);
      } else if (!['ul', 'table', 'img', 'swatches', 'contrast'].includes(key) && !str(b[key])) err.push(`${at}, теорія ${k + 1}: порожній текст.`);
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
      if (e.img !== undefined && !(ASSET_RE.test(e.img) && str(e.alt))) err.push(`${ex}: img — шлях до картинки в курсі, і обов'язково alt.`);
      if (e.type === 'choice') {
        if (!(Array.isArray(e.options) && e.options.length >= 2 && e.options.every(str))) err.push(`${ex}: options — щонайменше 2 варіанти.`);
        else if (!(Number.isInteger(e.a) && e.a >= 0 && e.a < e.options.length)) err.push(`${ex}: a — номер правильного варіанта від 0.`);
      } else if (e.type === 'number') {
        if (!Number.isFinite(e.a)) err.push(`${ex}: a — число (3.14), не рядок.`);
        if (e.tol !== undefined && !(Number.isFinite(e.tol) && e.tol >= 0)) err.push(`${ex}: tol — допуск, невід'ємне число.`);
        if (e.unit !== undefined && !str(e.unit)) err.push(`${ex}: unit — одиниці, рядок (« см²»).`);
      } else if (e.type === 'order') {
        if (!(Array.isArray(e.items) && e.items.length >= 3 && e.items.length <= 8 && e.items.every(str) && new Set(e.items).size === e.items.length)) {
          err.push(`${ex}: items — від 3 до 8 різних пунктів у правильному порядку.`);
        }
      } else if (e.type === 'spot') {
        if (e.img === undefined) err.push(`${ex}: spot — потрібна картинка img і alt.`);
        const a = e.a ?? {};
        if (![a.x, a.y, a.r].every(Number.isFinite) || a.x < 0 || a.x > 100 || a.y < 0 || a.y > 100 || !(a.r > 0 && a.r <= 50)) {
          err.push(`${ex}: a — {x, y, r} у відсотках картинки: центр цілі (0–100) і радіус (до 50, від ширини).`);
        }
      } else if (!(Array.isArray(e.a) && e.a.length && e.a.every(str))) err.push(`${ex}: a — список правильних відповідей.`);
    });
  });
  for (const path of assetsOf(pack)) {
    if (ASSET_RE.test(path) && !files.has(path)) err.push(`Картинки ${path} немає в курсі${files.size ? '' : ' — курс із картинками додається архівом .zip'}.`);
  }
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
// Курс → (шлях → адреса для <img>). SVG — data: (відкритий окремо, він не отримає наш origin), решта — blob:
const urls = new Map();

async function buildUrls(rec) {
  dropUrls(rec.id);
  const map = new Map();
  for (const [path, blob] of Object.entries(rec.files ?? {})) {
    map.set(path, mimeOf(path) === 'image/svg+xml'
      ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(await blob.text())}`
      : URL.createObjectURL(blob));
  }
  urls.set(rec.id, map);
}

function dropUrls(id) {
  for (const url of urls.get(id)?.values() ?? []) if (url.startsWith('blob:')) URL.revokeObjectURL(url);
  urls.delete(id);
}

/** Адреса картинки курсу для <img>; немає — порожній рядок. */
export const src = (cid) => (path) => urls.get(cid)?.get(path) ?? '';

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
  await buildUrls(rec);
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

/** Курс каталогу: файл .json або папка з course.json і картинками — їх беремо всі одразу, щоб курс працював без мережі. */
async function fetchPack(entry) {
  const base = entry.dir ? `./courses/${entry.dir}/` : './courses/';
  const res = await fetch(entry.dir ? `${base}course.json` : `${base}${entry.file}`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Курс не завантажився (HTTP ${res.status})`);
  const pack = await res.json();
  const files = {};
  for (const path of entry.dir ? assetsOf(pack) : []) {
    if (!ASSET_RE.test(path)) continue;
    const r = await fetch(base + path, { cache: 'no-cache' });
    if (!r.ok) throw new Error(`Не завантажилась картинка ${path} (HTTP ${r.status})`);
    files[path] = new Blob([await r.arrayBuffer()], { type: mimeOf(path) });
  }
  return { pack, files };
}

/** Картинки пакета: розмір і безпечний SVG. */
export async function checkFiles(files) {
  const err = [];
  for (const [path, blob] of Object.entries(files)) {
    if (blob.size > MAX_IMAGE) err.push(`Картинка ${path} завелика: ${Math.round(blob.size / 1024)} КБ, можна до ${MAX_IMAGE / 1e6} МБ (WebP чи менший розмір).`);
    if (mimeOf(path) === 'image/svg+xml' && unsafeSvg(await blob.text())) err.push(`У ${path} є скрипт чи обробник подій — такий SVG не приймаємо.`);
  }
  return err;
}

/** Встановити з каталогу (або оновити, якщо там новіша версія). */
export async function install(id) {
  const entry = (catalogCache ?? await catalog() ?? []).find((c) => c.id === id);
  if (!entry) throw new Error('Цього курсу немає в каталозі');
  const { pack, files } = await fetchPack(entry);
  const errors = [...validate(pack, new Set(Object.keys(files))), ...await checkFiles(files)];
  if (errors.length) throw new Error(errors[0]);
  const prev = installed.get(id);
  await put({ id, pack, files, from: 'catalog', enabled: prev?.enabled ?? true, added: prev?.added ?? Date.now() });
}

const fail = (message, errors = []) => Object.assign(new Error(message), { errors });

/** Архів: course.json у корені (або в одній папці — якщо стиснули саму папку курсу) і картинки поруч. */
export async function readZip(buf) {
  let entries;
  try { entries = await unzip(buf, { maxBytes: MAX_PACKAGE }); } catch (e) { throw fail(e.message); }
  const json = [...entries.keys()].filter((n) => n === 'course.json' || n.endsWith('/course.json')).sort((a, b) => a.length - b.length)[0];
  if (!json) throw fail('В архіві немає course.json — це не курс Буквоїда.');
  const root = json.slice(0, -'course.json'.length);
  let pack;
  try { pack = JSON.parse(new TextDecoder().decode(entries.get(json))); } catch { throw fail('course.json в архіві — не JSON.'); }
  const files = {};
  for (const [name, bytes] of entries) {
    const path = name.slice(root.length);
    if (name.startsWith(root) && ASSET_RE.test(path)) files[path] = new Blob([bytes], { type: mimeOf(path) });
  }
  return { pack, files };
}

/**
 * Курс із файлу (.json, або .zip з картинками): перевірка формату; той самий id — заміна
 * (прогрес лишається, він за id юнітів). Приймає File або текст JSON.
 */
export async function importFile(input) {
  let pack;
  let files = {};
  const blob = typeof input === 'string' ? new Blob([input]) : input;
  const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
  if (head[0] === 0x50 && head[1] === 0x4b) {
    if (blob.size > MAX_PACKAGE) throw fail(`Архів завеликий для курсу (до ${MAX_PACKAGE / 1e6} МБ).`);
    ({ pack, files } = await readZip(await blob.arrayBuffer()));
  } else {
    if (blob.size > MAX_BYTES) throw fail('Файл завеликий для курсу (до 3 МБ).');
    try { pack = JSON.parse(await blob.text()); } catch { throw fail('Це не JSON і не .zip — курс буває файлом .json або архівом .zip.'); }
  }
  const errors = [...validate(pack, new Set(Object.keys(files))), ...await checkFiles(files)];
  if (errors.length) throw fail('Файл не схожий на курс Буквоїда.', errors);
  const prev = installed.get(pack.id);
  await put({ id: pack.id, pack, files, from: 'file', enabled: true, added: prev?.added ?? Date.now() });
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
  dropUrls(id);
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
    for (const rec of all ?? []) { await buildUrls(rec); installed.set(rec.id, rec); }
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
