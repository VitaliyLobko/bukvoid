// Усі дані застосунку — один JSON у localStorage. Ключі з префіксом bukvoid:,
// бо на vitaliylobko.github.io сховище спільне з іншими застосунками.
// Лічильники (букви, хвилини, помилки клавіш) — окремо для кожного пристрою: при синхронізації
// вони складаються, а не перезаписують одне одного. Прогрес курсів — найкращий результат з усіх.
const KEY = 'bukvoid:state';
const DEVICE_KEY = 'bukvoid:device';

export const device = (() => {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) { id = `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`; localStorage.setItem(DEVICE_KEY, id); }
    return id;
  } catch {
    return 'd-local';
  }
})();

const emptyDev = () => ({ keys: {}, days: {}, chars: 0, ms: 0, sessions: 0, bestCpm: 0 });

const empty = () => ({
  v: 2,
  epoch: 0,       // мітка «Стерти» чи відновлення з копії: новіша епоха замінює все старе
  settings: { theme: 'auto', lang: 'uk', mode: 'stop', keyboard: true, level: 'a2', fontSize: 'm' },
  typing: {},     // 'uk:3' → {parts: {a: {acc, cpm}}, done}
  spelling: {},   // topicId → {best, total, at}
  english: {},    // unitId → {best, total, at}
  srs: {},        // cardId → {box, due, at}
  dev: {},        // пристрій → {keys: {uk: {'п': {n, e, t}}}, days: {дата: {chars, ms, errors}}, chars, ms, sessions, bestCpm}
});

let state = load();

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw?.v === 2) return normalize(raw);
    if (raw?.v === 1) return migrate(raw);
  } catch { /* приватний режим або зіпсований JSON */ }
  return empty();
}

function normalize(raw) {
  const def = empty();
  return { ...def, ...raw, settings: { ...def.settings, ...raw.settings } };
}

/** 0.1.0 тримав лічильники спільно — переносимо їх на цей пристрій. */
function migrate(old) {
  const s = normalize({ ...old, v: 2 });
  const d = emptyDev();
  d.keys = old.keys || {};
  d.days = old.days || {};
  Object.assign(d, { chars: old.totals?.chars || 0, ms: old.totals?.ms || 0, sessions: old.totals?.sessions || 0, bestCpm: old.totals?.bestCpm || 0 });
  s.dev = { [device]: d };
  delete s.keys; delete s.days; delete s.totals;
  return s;
}

export const get = () => state;
const mine = () => (state.dev[device] ||= emptyDev());

export function save({ silent = false } = {}) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* немає місця або приватний режим */ }
  if (!silent) window.dispatchEvent(new Event('bukvoid-change'));
}

export function update(fn) {
  fn(state);
  save();
}

/** Дата за місцевим часом: toISOString дав би UTC, і друк після опівночі за Києвом пішов би у вчора. */
export const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const today = () => dayKey(new Date());

// ---------- зведення по всіх пристроях ----------

export function keyStats(lang) {
  const out = {};
  for (const d of Object.values(state.dev)) {
    for (const [ch, k] of Object.entries(d.keys[lang] || {})) {
      const cur = (out[ch] ||= { n: 0, e: 0, t: 0 });
      cur.n += k.n; cur.e += k.e; cur.t += k.t;
    }
  }
  return out;
}

/** День по всіх пристроях: друк (ms, chars, errors), тести й повторення (qms), пройдені уроки, найкращі бали тестів. */
export function day(key) {
  const out = { chars: 0, ms: 0, errors: 0, qms: 0, srs: 0, passed: [], tests: {} };
  for (const d of Object.values(state.dev)) {
    const x = d.days[key];
    if (!x) continue;
    out.chars += x.chars; out.ms += x.ms; out.errors += x.errors;
    out.qms += x.qms || 0;
    out.srs += x.srs || 0;
    for (const id of x.passed || []) if (!out.passed.includes(id)) out.passed.push(id);
    for (const [id, [s, n]] of Object.entries(x.tests || {})) if (!out.tests[id] || s > out.tests[id][0]) out.tests[id] = [s, n];
  }
  return out;
}

export function totals() {
  const out = { chars: 0, ms: 0, sessions: 0, bestCpm: 0 };
  for (const d of Object.values(state.dev)) {
    out.chars += d.chars; out.ms += d.ms; out.sessions += d.sessions;
    out.bestCpm = Math.max(out.bestCpm, d.bestCpm);
  }
  return out;
}

/** Підсумок вправи з друку: статистика клавіш, день, лічильники цього пристрою. */
export function recordSession({ lang, chars, ms, errors, cpm, keyStats: ks }) {
  update(() => {
    const d = mine();
    const keys = (d.keys[lang] ||= {});
    for (const [ch, k] of Object.entries(ks)) {
      const cur = (keys[ch] ||= { n: 0, e: 0, t: 0 });
      cur.n += k.n; cur.e += k.e; cur.t += k.t;
    }
    const x = myDay(d);
    x.chars += chars; x.ms += ms; x.errors += errors;
    d.chars += chars;
    d.ms += ms;
    d.sessions += 1;
    if (chars >= 40) d.bestCpm = Math.max(d.bestCpm, cpm);
  });
}

const myDay = (d) => {
  d.ops = (d.ops ?? d.sessions) + 1;
  return (d.days[today()] ||= { chars: 0, ms: 0, errors: 0 });
};

// Пауза довша — людина відійшла: у час навчання не йде (як простій понад 2 с у друці)
const STUDY_GAP_MAX = 120_000;

/** Час над тестом чи повторенням — від показу питання до відповіді. */
export function recordStudyTime(ms, { srs = false } = {}) {
  if (!(ms > 0)) return;
  update(() => {
    const x = myDay(mine());
    x.qms = (x.qms || 0) + Math.min(ms, STUDY_GAP_MAX);
    if (srs) x.srs = (x.srs || 0) + 1;
  });
}

/** Тест правопису чи юніту англійської пройдено повністю: найкращий бал за день. */
export function recordTest(id, score, total) {
  update(() => {
    const x = myDay(mine());
    const prev = x.tests?.[id];
    if (!prev || score > prev[0]) (x.tests ||= {})[id] = [score, total];
  });
}

/** Урок друку вперше зараховано — у підсумок дня. */
export function recordPassed(lessonId) {
  update(() => {
    const x = myDay(mine());
    if (!(x.passed ||= []).includes(lessonId)) x.passed.push(lessonId);
  });
}

// ---------- злиття двох копій (цей пристрій і Google Диск) ----------

const better = (a, b) => (!a ? b : !b ? a : (b.acc > a.acc || (b.acc === a.acc && b.cpm > a.cpm)) ? b : a);
const bestOf = (a, b) => (!a ? b : !b ? a : (b.best > a.best || (b.best === a.best && (b.at || '') > (a.at || ''))) ? b : a);
const newer = (a, b) => (!a ? b : !b ? a : (b.at || 0) > (a.at || 0) ? b : a);
// Лічильники пристрою лише ростуть: новіша копія — та, де записів більше (ops; до нього — вправ друку)
const opsOf = (d) => d.ops ?? d.sessions;
const fuller = (a, b) => (!a ? b : !b ? a : (opsOf(b) > opsOf(a) || (opsOf(b) === opsOf(a) && b.chars > a.chars)) ? b : a);

function mergeMap(a = {}, b = {}, pick) {
  const out = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) out[k] = pick(a[k], b[k]);
  return out;
}

/** Синхронізовані частини; налаштування лишаються свої на кожному пристрої. */
export function merge(local, remote) {
  if (!remote) return local;
  const le = local.epoch || 0;
  const re = remote.epoch || 0;
  if (re > le) return { ...normalize(remote), settings: local.settings };
  if (le > re) return local;
  const typing = mergeMap(local.typing, remote.typing, (a, b) => {
    if (!a || !b) return a || b;
    const parts = mergeMap(a.parts, b.parts, better);
    return { parts, done: Boolean(a.done || b.done) };
  });
  return {
    ...local,
    typing,
    spelling: mergeMap(local.spelling, remote.spelling, bestOf),
    english: mergeMap(local.english, remote.english, bestOf),
    srs: mergeMap(local.srs, remote.srs, newer),
    dev: mergeMap(local.dev, remote.dev, fuller),
  };
}

/** Частина стану, що їде на Диск. */
export const synced = () => {
  const { settings, ...rest } = state;
  return rest;
};

/** Прийняти злиту копію; true — щось змінилося й екран треба перемалювати. */
export function adopt(merged) {
  const before = JSON.stringify(synced());
  state = { ...merged, settings: state.settings };
  const changed = JSON.stringify(synced()) !== before;
  if (changed) save({ silent: true });
  return changed;
}

export function exportJson() {
  return JSON.stringify(state, null, 1);
}

export function importJson(text) {
  const raw = JSON.parse(text);
  if (!raw || (raw.v !== 1 && raw.v !== 2)) throw new Error('bad-file');
  // Копія стає правдою для всіх пристроїв: нова епоха
  const s = raw.v === 1 ? migrate(raw) : normalize(raw);
  state = { ...s, settings: state.settings, epoch: Date.now() };
  save();
}

export function reset() {
  state = { ...empty(), settings: state.settings, epoch: Date.now() };
  save();
}
