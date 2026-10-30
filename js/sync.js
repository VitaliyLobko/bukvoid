// Синхронізація прогресу з файлом bukvoid.json на Google Диску власника.
// Офлайн-перший підхід: усе пишеться в localStorage, а на Диск їде, коли є мережа.
// Злиття — store.merge: найкращі результати курсів, лічильники кожного пристрою окремо, новіша епоха замінює все.
import * as S from './store.js';
import { GOOGLE_CLIENT_ID } from './config.js';
import { sharedToken, shareToken, dropSharedToken, noteEmail } from './google-token.js';
import { locate, readJson, writeJson } from './drive-files.js';
import { active as serverOn } from './bot.js';

const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const FILE_NAME = 'bukvoid.json';
const DRIVE = 'https://www.googleapis.com/drive/v3';
const KEY = 'bukvoid:sync';

class AuthError extends Error {}

class ApiError extends Error {
  constructor(status) {
    super(`Google Диск відповів ${status}`);
    this.status = status;
  }
}

let conf = load();
let tokenClient = null;
let gisLoading = null;
let authWaiter = null;
let timer = null;
let running = false;
let again = false;
const listeners = new Set();

/** state: off | idle | syncing | offline | auth | error */
export const status = { state: 'off', message: '' };

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { return {}; }
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(conf)); } catch { /* приватний режим */ }
}

function set(state, message = '') {
  Object.assign(status, { state, message, lastSync: conf.lastSync ?? null, email: conf.email ?? null });
  listeners.forEach((fn) => fn(status));
}

/** Слухач стану; повертає відписку (екран налаштувань живе недовго). */
export function onStatus(fn) {
  listeners.add(fn);
  fn(status);
  return () => listeners.delete(fn);
}

export const enabled = () => Boolean(conf.enabled);

/** Свій ключ живий — його; ні — спільний з іншого застосунку автора (вхід там годиться й тут). */
function tokenValid() {
  if (conf.token && conf.expires > Date.now() + 60_000) return true;
  const s = sharedToken(conf);
  if (!s) return false;
  conf.token = s.token;
  conf.expires = s.expires;
  save();
  return true;
}

// ---------- вхід ----------

function loadGis() {
  gisLoading ??= new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => { gisLoading = null; reject(new Error('Немає зв\'язку з Google')); };
    document.head.append(script);
  });
  return gisLoading;
}

function finishAuth(error) {
  const waiter = authWaiter;
  authWaiter = null;
  if (error) waiter?.reject(error);
  else waiter?.resolve();
}

function client() {
  if (tokenClient || !window.google?.accounts?.oauth2) return tokenClient;
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: SCOPE,
    callback: (resp) => {
      if (resp.error) { finishAuth(new Error(resp.error_description || resp.error)); return; }
      conf.token = resp.access_token;
      conf.expires = Date.now() + (Number(resp.expires_in) || 3600) * 1000;
      shareToken(conf.token, conf.expires, conf.email);
      save();
      finishAuth();
    },
    error_callback: (err) => finishAuth(new Error(err?.type === 'popup_closed' ? 'Вхід скасовано' : (err?.message || 'Помилка входу в Google'))),
  });
  return tokenClient;
}

/** Підвантажити Google Sign-In заздалегідь: вікно входу має відкритися синхронно з дотику. */
export function preload() {
  if (navigator.onLine) loadGis().then(client).catch(() => {});
}

/** Викликати лише з обробника кліку — інакше браузер заблокує вікно входу. */
export async function connect() {
  // Увійшли в іншому застосунку автора менш ніж годину тому — вікно Google не потрібне
  if (!tokenValid()) {
    const c = client();
    if (!c) {
      preload();
      throw new Error('Google ще завантажується — натисніть ще раз за секунду');
    }
    await new Promise((resolve, reject) => {
      authWaiter = { resolve, reject, at: Date.now() };
      c.requestAccessToken({ prompt: conf.consented ? '' : 'consent', hint: conf.email || undefined });
    });
  }
  conf.enabled = true;
  conf.consented = true;
  save();
  await syncNow();
}

/**
 * Ключ Google живе годину, а вікно входу браузер дозволяє лише з дотику. Прострочений ключ оновлюємо з
 * дотику, який людина й так робить (кнопки «Почати», «Ще раз», «Далі»): згоду вже дано, вікно мигне й закриється.
 */
export function renewOnGesture() {
  const busy = authWaiter && Date.now() - (authWaiter.at ?? 0) < 60_000;
  if (!conf.enabled || !conf.consented || tokenValid() || !navigator.onLine || busy) return;
  const c = client();
  if (!c) { preload(); return; }
  authWaiter = { resolve: () => syncNow(), reject: () => {}, at: Date.now() };
  c.requestAccessToken({ prompt: '', hint: conf.email || undefined });
}

export function disconnect() {
  // Вхід у Google не відкликаємо: він спільний з іншими застосунками автора — відключається лише цей
  conf = {};
  save();
  set('off');
}

// ---------- Google Drive ----------

async function api(url, options = {}) {
  const res = await fetch(url, { ...options, headers: { Authorization: `Bearer ${conf.token}`, ...options.headers } });
  if (res.status === 401) {
    dropSharedToken(conf.token);
    conf.token = null;
    save();
    throw new AuthError('Сесія Google завершилась');
  }
  if (!res.ok) throw new ApiError(res.status);
  return res;
}

/** Записати знімок у bukvoid.json. false — інший пристрій щойно завів файл: синхронізуватись ще раз, із ним. */
async function upload(fileId, data) {
  const content = JSON.stringify({ app: 'bukvoid', format: 2, exportedAt: new Date().toISOString(), data });
  const res = await writeJson(api, { id: fileId, name: FILE_NAME, description: 'Буквоїд: прогрес', content });
  conf.fileId = res.id;
  save();
  return res.written;
}

// ---------- цикл синхронізації ----------

export async function syncNow() {
  if (!conf.enabled) { set('off'); return; }
  if (!navigator.onLine) { set('offline'); return; }
  if (!tokenValid()) { set('auth', 'Натисніть, щоб увійти в Google'); return; }
  if (running) { again = true; return; }
  running = true;
  set('syncing');
  try {
    if (!conf.email) {
      const about = await (await api(`${DRIVE}/about?fields=user(emailAddress)`)).json();
      conf.email = about.user?.emailAddress ?? null;
      noteEmail(conf.token, conf.email);
    }
    const fileId = await locate(api, FILE_NAME, conf.fileId);
    conf.fileId = fileId;
    const remote = fileId ? ((await readJson(api, fileId))?.data ?? null) : null;
    const local = S.get();
    const merged = S.merge(local, remote);
    const changed = S.adopt(merged);
    const mergedSynced = S.synced();
    if ((!remote || JSON.stringify(remote) !== JSON.stringify(mergedSynced)) && !(await upload(fileId, mergedSynced))) again = true;
    conf.lastSync = Date.now();
    save();
    set('idle');
    if (changed) window.dispatchEvent(new Event('sync-applied'));
  } catch (err) {
    if (err instanceof AuthError) set('auth', 'Натисніть, щоб увійти в Google');
    else set(navigator.onLine ? 'error' : 'offline', err.message);
  } finally {
    running = false;
    // Повтор — мимо щоденного правила: це той самий обмін, що не завершився
    if (again) { again = false; clearTimeout(timer); timer = setTimeout(syncNow, 500); }
  }
}

// Синхронізація через сервер бота ввімкнена — Диск лише щоденна копія (як у Вазі й Марнотраті)
const DAILY_MS = 24 * 60 * 60 * 1000;
const autoDue = () => !serverOn() || Date.now() - (conf.lastSync || 0) > DAILY_MS;

export function schedule(ms = 3000) {
  if (!autoDue()) return;
  clearTimeout(timer);
  timer = setTimeout(syncNow, ms);
}

export function start() {
  set(conf.enabled ? 'idle' : 'off');
  if (!conf.enabled) return;
  preload();
  schedule(800);
}

window.addEventListener('bukvoid-change', () => { if (conf.enabled) schedule(); });
window.addEventListener('online', () => { if (conf.enabled) { preload(); schedule(500); } });
document.addEventListener('visibilitychange', () => {
  if (conf.enabled && document.visibilityState === 'visible') schedule(300);
  // Закриваємо застосунок — віддати свіже одразу, не чекаючи таймера
  if (conf.enabled && document.visibilityState === 'hidden' && timer && autoDue()) { clearTimeout(timer); timer = null; syncNow(); }
});
