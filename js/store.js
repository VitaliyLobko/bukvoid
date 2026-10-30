// Усі дані застосунку — один JSON у localStorage. Ключі з префіксом bukvoid:,
// бо на vitaliylobko.github.io сховище спільне з іншими застосунками.
const KEY = 'bukvoid:state';

const empty = () => ({
  v: 1,
  settings: { theme: 'auto', lang: 'uk', mode: 'stop', keyboard: true, level: 'a2' },
  typing: {},     // 'uk:3' → {parts: {a: {acc, cpm}}, done, best}
  keys: {},       // 'uk' → {'п': {n, e, t}}
  days: {},       // '2026-10-30' → {chars, ms, errors}
  spelling: {},   // topicId → {best, total, at}
  english: {},    // unitId → {best, total, at, seen}
  srs: {},        // cardId → {box, due}
  totals: { chars: 0, sessions: 0, ms: 0, bestCpm: 0 },
});

let state = load();

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && raw.v === 1) return mergeDefaults(raw);
  } catch { /* приватний режим або зіпсований JSON */ }
  return empty();
}

function mergeDefaults(raw) {
  const def = empty();
  return { ...def, ...raw, settings: { ...def.settings, ...raw.settings }, totals: { ...def.totals, ...raw.totals } };
}

export const get = () => state;

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* немає місця або приватний режим */ }
}

export function update(fn) {
  fn(state);
  save();
}

export const today = () => dayKey(new Date());

/** Дата за місцевим часом: toISOString дав би UTC, і друк після опівночі за Києвом пішов би у вчора. */
export const dayKey = (d) => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Підсумок вправи з друку: статистика клавіш, день, загальні лічильники. */
export function recordSession({ lang, chars, ms, errors, cpm, keyStats }) {
  update((s) => {
    const keys = (s.keys[lang] ||= {});
    for (const [ch, k] of Object.entries(keyStats)) {
      const cur = (keys[ch] ||= { n: 0, e: 0, t: 0 });
      cur.n += k.n; cur.e += k.e; cur.t += k.t;
    }
    const day = (s.days[today()] ||= { chars: 0, ms: 0, errors: 0 });
    day.chars += chars; day.ms += ms; day.errors += errors;
    s.totals.chars += chars;
    s.totals.ms += ms;
    s.totals.sessions += 1;
    if (chars >= 40) s.totals.bestCpm = Math.max(s.totals.bestCpm, cpm);
  });
}

export function exportJson() {
  return JSON.stringify(state, null, 1);
}

export function importJson(text) {
  const raw = JSON.parse(text);
  if (!raw || raw.v !== 1) throw new Error('Це не копія Буквоїда');
  state = mergeDefaults(raw);
  save();
}

export function reset() {
  state = empty();
  save();
}
