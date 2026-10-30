// Фізичні клавіші (KeyboardEvent.code) рядами — однакові для всіх розкладок.
export const ROWS = [
  ['Backquote', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal'],
  ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft', 'BracketRight', 'Backslash'],
  ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote'],
  ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash'],
];

// Палець для кожної клавіші: l/r + 1 мізинець … 4 вказівний, t — великий.
const FINGER_OF = {
  Backquote: 'l1', Digit1: 'l1', KeyQ: 'l1', KeyA: 'l1', KeyZ: 'l1',
  Digit2: 'l2', KeyW: 'l2', KeyS: 'l2', KeyX: 'l2',
  Digit3: 'l3', KeyE: 'l3', KeyD: 'l3', KeyC: 'l3',
  Digit4: 'l4', Digit5: 'l4', KeyR: 'l4', KeyT: 'l4', KeyF: 'l4', KeyG: 'l4', KeyV: 'l4', KeyB: 'l4',
  Digit6: 'r4', Digit7: 'r4', KeyY: 'r4', KeyU: 'r4', KeyH: 'r4', KeyJ: 'r4', KeyN: 'r4', KeyM: 'r4',
  Digit8: 'r3', KeyI: 'r3', KeyK: 'r3', Comma: 'r3',
  Digit9: 'r2', KeyO: 'r2', KeyL: 'r2', Period: 'r2',
  Digit0: 'r1', Minus: 'r1', Equal: 'r1', KeyP: 'r1', BracketLeft: 'r1', BracketRight: 'r1',
  Backslash: 'r1', Semicolon: 'r1', Quote: 'r1', Slash: 'r1',
  Space: 't',
};

export const FINGER_NAMES = {
  l1: 'лівий мізинець', l2: 'лівий безіменний', l3: 'лівий середній', l4: 'лівий вказівний',
  r4: 'правий вказівний', r3: 'правий середній', r2: 'правий безіменний', r1: 'правий мізинець',
  t: 'великий палець',
};

// Клавіші основної позиції: тут пальці лежать між натисканнями.
export const HOME = { l1: 'KeyA', l2: 'KeyS', l3: 'KeyD', l4: 'KeyF', r4: 'KeyJ', r3: 'KeyK', r2: 'KeyL', r1: 'Semicolon' };

export const finger = (code) => FINGER_OF[code] || 'r1';

const SHIFT_DIGITS_CYR = { Backquote: null, Digit1: '!', Digit2: '"', Digit3: '№', Digit4: ';', Digit5: '%', Digit6: ':', Digit7: '?', Digit8: '*', Digit9: '(', Digit0: ')', Minus: '_', Equal: '+', Slash: ',' };

const base = (letters) => {
  const codes = ROWS.flat();
  const lower = {};
  codes.forEach((code, i) => { lower[code] = letters[i]; });
  return lower;
};

// Порядок символів — як у ROWS. «Українська (розширена)» Windows: ґ — праворуч від ї, апостроф — ліворуч від 1.
const LOWER = {
  uk: base(["'", '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=',
    'й', 'ц', 'у', 'к', 'е', 'н', 'г', 'ш', 'щ', 'з', 'х', 'ї', 'ґ',
    'ф', 'і', 'в', 'а', 'п', 'р', 'о', 'л', 'д', 'ж', 'є',
    'я', 'ч', 'с', 'м', 'и', 'т', 'ь', 'б', 'ю', '.']),
  ru: base(['ё', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=',
    'й', 'ц', 'у', 'к', 'е', 'н', 'г', 'ш', 'щ', 'з', 'х', 'ъ', '\\',
    'ф', 'ы', 'в', 'а', 'п', 'р', 'о', 'л', 'д', 'ж', 'э',
    'я', 'ч', 'с', 'м', 'и', 'т', 'ь', 'б', 'ю', '.']),
  en: base(['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=',
    'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']', '\\',
    'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'",
    'z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/']),
};

const SHIFT_EN = { Backquote: '~', Digit1: '!', Digit2: '@', Digit3: '#', Digit4: '$', Digit5: '%', Digit6: '^', Digit7: '&', Digit8: '*', Digit9: '(', Digit0: ')', Minus: '_', Equal: '+', BracketLeft: '{', BracketRight: '}', Backslash: '|', Semicolon: ':', Quote: '"', Comma: '<', Period: '>', Slash: '?' };

export const LANG_NAMES = { uk: 'Українська', ru: 'Російська', en: 'Англійська' };

const STORE_KEY = 'bukvoid:layout:';

/** Розкладка мови: code → {lower, upper}; підміняється справжньою, якщо браузер її повідомив. */
export function layout(lang) {
  const lower = { ...LOWER[lang] };
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY + lang) || 'null');
    if (saved) Object.assign(lower, saved);
  } catch { /* приватний режим */ }
  const keys = {};
  for (const code of ROWS.flat()) {
    const lo = lower[code];
    const shift = lang === 'en' ? SHIFT_EN : SHIFT_DIGITS_CYR;
    const up = shift[code] !== undefined && shift[code] !== null ? shift[code] : lo.toUpperCase();
    keys[code] = { lower: lo, upper: up === lo && !/\p{L}/u.test(lo) ? null : up };
  }
  return keys;
}

/** Де шукати символ: {code, shift}. Пробіл — великим пальцем. */
export function locate(keys, ch) {
  if (ch === ' ') return { code: 'Space', shift: false };
  for (const [code, k] of Object.entries(keys)) {
    if (k.lower === ch) return { code, shift: false };
    if (k.upper === ch) return { code, shift: true };
  }
  return null;
}

/** Shift натискає мізинець протилежної руки. */
export const shiftFor = (code) => (finger(code).startsWith('l') ? 'ShiftRight' : 'ShiftLeft');

/**
 * Chromium на комп'ютері повідомляє поточну розкладку: по ній визначаємо мову
 * і запам'ятовуємо реальні позиції (ґ, апостроф, ё бувають на різних клавішах).
 */
export async function detectLayout() {
  try {
    if (!navigator.keyboard?.getLayoutMap) return null;
    const map = await navigator.keyboard.getLayoutMap();
    const s = map.get('KeyS');
    const lang = s === 'і' ? 'uk' : s === 'ы' ? 'ru' : s === 's' ? 'en' : null;
    if (!lang) return null;
    const lower = {};
    for (const code of ROWS.flat()) {
      const ch = map.get(code);
      if (ch) lower[code] = ch;
    }
    try { localStorage.setItem(STORE_KEY + lang, JSON.stringify(lower)); } catch { /* приватний режим */ }
    return lang;
  } catch {
    return null;
  }
}

/** Яким письмом набрано символ — щоб підказати «перемкніть розкладку». */
export function script(ch) {
  if (/[a-z]/i.test(ch)) return 'lat';
  if (/[іїєґ]/i.test(ch)) return 'uk';
  if (/[ыэъё]/i.test(ch)) return 'ru';
  if (/\p{Script=Cyrillic}/u.test(ch)) return 'cyr';
  return null;
}
