// Сервер бота Хобі-плану (Cloudflare Worker + D1) — тим самим ключем доступу, що й Хобі-план, Вага й Марнотрат.
// 1) Синхронізація: кожен пристрій пише в базу лише свої частини стану (/api/records, store 'part', id
//    «пристрій:частина»), а чужі зливає store.merge — тож пристрої не перезаписують одне одного.
// 2) Підсумки в Telegram: дні за 5 тижнів, фрази на повторення наперед, слабкі клавіші (/api/study).
//    Набраних текстів і статистики клавіш бот не отримує.
import * as S from './store.js';
import * as BK from './bot-key.js';
import { exchange, cursors } from './cloud.js';

const APP = 'bukvoid';
const STORE = 'part';
const KEYS = {
  declined: 'bukvoid:bot-declined', stamps: 'bukvoid:cloud-stamps',
  studyOff: 'bukvoid:study-off', studySig: 'bukvoid:study-sig', studyAt: 'bukvoid:study-at',
};
// Те саме ще раз не шлемо, але раз на пів години — так: бот бачить, що дані свіжі
const RESEND_MS = 30 * 60 * 1000;

const cur = cursors(APP);
let payload = () => null;
let timer = 0;
let running = false;
let again = false;
const listeners = new Set();

/** state: off | idle | syncing | offline | key | old | error */
export const status = { state: 'off', message: '' };

function get(k) {
  try { return localStorage.getItem(k); } catch { return null; }
}

function set(k, v) {
  try {
    if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, String(v));
  } catch { /* приватний режим */ }
}

function json(k, fallback) {
  try { return JSON.parse(get(k)) ?? fallback; } catch { return fallback; }
}

function setStatus(state, message = '') {
  Object.assign(status, { state, message, last: cur.last() || null });
  listeners.forEach((fn) => fn(status));
}

export function onStatus(fn) {
  listeners.add(fn);
  fn(status);
  return () => listeners.delete(fn);
}

// ---------- адреса й ключ ----------

const declinedAt = () => Number(get(KEYS.declined) || 0);

/** Адреса й ключ, спільні для застосунків на пристрої; null — синхронізацію не ввімкнено чи ключ не підходить. */
export const config = () => BK.current(declinedAt());
export const keyProblem = () => BK.keyProblem(declinedAt());
export const active = () => Boolean(config());

/** Вставили тут — для всіх застосунків на пристрої (Хобі-план, Вага, Марнотрат візьмуть його самі). */
export function setConfig(url, key) {
  set(KEYS.declined, null);
  BK.publish(url, key);
  set(KEYS.studySig, null);
  schedule(0);
}

/** «Вимкнути синхронізацію» — лише в Буквоїді на цьому пристрої; інші застосунки лишаються з сервером. */
export function disconnect() {
  set(KEYS.declined, Date.now());
  setStatus('off');
}

export const studyOn = () => get(KEYS.studyOff) !== '1';
export const studyAt = () => Number(get(KEYS.studyAt) || 0);

export function setStudyOn(on) {
  set(KEYS.studyOff, on ? null : '1');
  set(KEYS.studySig, null);
  if (on) schedule(0);
}

// ---------- частини стану ----------

const SRS_UNIT = (id) => id.slice(0, id.indexOf(':'));

/**
 * Свої частини: core — курси (уже злиті з усіх пристроїв), srs — колода по юнітах, dev — лічильники лише цього
 * пристрою, days — його дні по місяцях. Кожна частина несе epoch: «Стерти» на іншому пристрої відкидає старі.
 */
function pieces() {
  const s = S.get();
  const { epoch = 0 } = s;
  // spelling — копія правопису для пристроїв на 0.1.x
  const out = { core: { epoch, typing: s.typing, courses: s.courses, spelling: s.courses[S.SPELLING_COURSE] ?? {}, english: s.english } };
  const units = {};
  for (const [id, c] of Object.entries(s.srs)) (units[SRS_UNIT(id)] ||= {})[id] = c;
  for (const [u, srs] of Object.entries(units)) out[`srs:${u}`] = { epoch, srs };
  const mine = s.dev[S.device];
  if (mine) {
    const { days, ...counters } = mine;
    out.dev = { epoch, dev: counters };
    const months = {};
    for (const [d, x] of Object.entries(days)) (months[d.slice(0, 7)] ||= {})[d] = x;
    for (const [m, list] of Object.entries(months)) out[`days:${m}`] = { epoch, days: list };
  }
  return out;
}

/** Мітка часу частини: змінився вміст — новий updated (не менший за попередній + 1). */
function records() {
  const stamps = json(KEYS.stamps, {});
  const now = Date.now();
  const list = [];
  for (const [part, data] of Object.entries(pieces())) {
    const id = `${S.device}:${part}`;
    const body = JSON.stringify(data);
    let st = stamps[id];
    if (!st || st[0] !== hash(body)) st = stamps[id] = [hash(body), Math.max(now, (st?.[1] ?? 0) + 1)];
    list.push({ store: STORE, id, data, updated: st[1] });
  }
  set(KEYS.stamps, JSON.stringify(stamps));
  return list;
}

function hash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(36) + s.length.toString(36);
}

/**
 * Частини інших пристроїв → стан кожного пристрою окремо; злиття — по одному, з правилом епохи.
 * Обмін віддає лише змінені частини: лічильники й дні пристрою накладаються на вже відомі тут
 * (тієї ж епохи), інакше прийшли б лише нові дні — і старі зникли б при злитті.
 */
function foreign(rows) {
  const by = new Map();
  for (const r of rows) {
    if (r.deleted || r.store !== STORE || !r.data) continue;
    const sep = r.id.indexOf(':');
    const dev = r.id.slice(0, sep);
    const part = r.id.slice(sep + 1);
    if (dev === S.device) continue;
    const x = by.get(dev) ?? { dev, epoch: 0, parts: [] };
    x.epoch = Math.max(x.epoch, r.data.epoch || 0);
    x.parts.push([part, r.data]);
    by.set(dev, x);
  }
  const local = S.get();
  return [...by.values()].map(({ dev, epoch, parts }) => {
    const out = { v: 2, epoch, typing: {}, courses: {}, english: {}, srs: {}, dev: {} };
    const known = epoch === (local.epoch || 0) ? local.dev[dev] : null;
    let counters = null;
    const days = { ...known?.days };
    for (const [part, d] of parts) {
      if ((d.epoch || 0) !== epoch) continue;
      if (part === 'core') Object.assign(out, { typing: d.typing ?? {}, courses: d.courses ?? {}, spelling: d.spelling ?? {}, english: d.english ?? {} });
      else if (part.startsWith('srs:')) Object.assign(out.srs, d.srs);
      else if (part === 'dev') counters = d.dev;
      else if (part.startsWith('days:')) Object.assign(days, d.days);
    }
    const base = counters ?? known;
    if (base) out.dev[dev] = { keys: {}, chars: 0, ms: 0, sessions: 0, bestCpm: 0, ...base, days };
    return out;
  });
}

// ---------- обмін ----------

export function start(buildPayload) {
  payload = buildPayload;
  if (config()) schedule(800);
  else setStatus(keyProblem() ? 'key' : 'off', keyProblem() ? 'Ключ доступу не підходить' : '');
  BK.onShared(() => schedule(300));
}

export function schedule(ms = 3000) {
  if (!config()) return;
  clearTimeout(timer);
  timer = setTimeout(() => { run().catch(() => {}); }, ms);
}

/** Один обмін записами, потім — підсумки для Telegram. */
export async function run() {
  const cfg = config();
  if (!cfg) { setStatus(keyProblem() ? 'key' : 'off'); return; }
  if (!navigator.onLine) { setStatus('offline'); return; }
  if (running) { again = true; return; }
  running = true;
  setStatus('syncing');
  try {
    const { rows, commit } = await exchange({ url: cfg.url, key: cfg.key, app: APP, prefix: APP, records: records() });
    BK.markOk(cfg);
    let changed = false;
    for (const remote of foreign(rows)) changed = S.adopt(S.merge(S.get(), remote)) || changed;
    commit();
    // Чуже злилось у своє — свої частини змінились: наступний обмін їх віддасть
    if (changed) { again = true; window.dispatchEvent(new Event('sync-applied')); }
    await pushStudy(cfg);
    setStatus('idle');
  } catch (err) {
    if (err.status === 401) { BK.markBad(cfg); setStatus('key', 'Ключ доступу не підходить'); }
    // 400/404 — сервер ще без Буквоїда (новий код бота не залито): не ключ, просто чекаємо
    else if (err.status === 400 || err.status === 404) setStatus('old', 'Сервер ще не оновлено для Буквоїда');
    else setStatus(navigator.onLine ? 'error' : 'offline', err instanceof TypeError ? 'Немає зв’язку з сервером' : err.message);
  } finally {
    running = false;
    if (again) { again = false; schedule(500); }
  }
}

async function pushStudy(cfg) {
  if (!studyOn()) return;
  const body = payload();
  if (!body) return;
  const sig = JSON.stringify(body);
  if (sig === get(KEYS.studySig) && Date.now() - studyAt() < RESEND_MS) return;
  const res = await fetch(`${cfg.url}/api/study`, {
    method: 'POST',
    headers: { authorization: `Bearer ${cfg.key}`, 'content-type': 'application/json' },
    body: sig,
  });
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
  set(KEYS.studySig, sig);
  set(KEYS.studyAt, Date.now());
}

window.addEventListener('bukvoid-change', () => schedule());
// Злите з Google Диска зберігається тихо — на сервер його теж треба віддати
window.addEventListener('sync-applied', () => schedule());
window.addEventListener('online', () => schedule(500));
document.addEventListener('visibilitychange', () => {
  if (!config()) return;
  if (document.visibilityState === 'visible') schedule(300);
  // Закриваємо застосунок — віддати свіже одразу, не чекаючи таймера
  else if (timer) { clearTimeout(timer); timer = 0; run().catch(() => {}); }
});
