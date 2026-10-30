import { get, update, today } from './store.js';

// Коробки Лейтнера: правильна відповідь — у наступну, помилка — назад у першу.
const INTERVALS = [0, 1, 2, 4, 8, 16, 32];

const addDays = (iso, n) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export const cardId = (unitId, word) => `${unitId}:${word.en}`;

/** Слова юніту потрапляють у повторення, щойно юніт відкрито. */
export function enroll(unit) {
  const s = get();
  if (unit.words.every((w) => s.srs[cardId(unit.id, w)])) return;
  update((st) => {
    for (const w of unit.words) st.srs[cardId(unit.id, w)] ||= { box: 0, due: today(), at: Date.now() };
  });
}

export function dueCards(levels) {
  const s = get();
  const t = today();
  const out = [];
  for (const level of levels) {
    for (const unit of level.units) {
      for (const w of unit.words) {
        const c = s.srs[cardId(unit.id, w)];
        if (c && c.due <= t) out.push({ id: cardId(unit.id, w), unit, word: w, box: c.box });
      }
    }
  }
  return out;
}

export function grade(id, ok) {
  update((s) => {
    const c = s.srs[id];
    if (!c) return;
    c.box = ok ? Math.min(c.box + 1, INTERVALS.length - 1) : 0;
    c.due = addDays(today(), ok ? INTERVALS[c.box] : 0);
    c.at = Date.now();
  });
}

/** Скільки фраз чекатиме на кожну дату тижня, якщо не повторювати: боту — для ранку й вечірнього нагадування. */
export function dueForecast(levels, days = 7) {
  const s = get();
  const dates = Array.from({ length: days }, (_, i) => addDays(today(), i));
  const out = Object.fromEntries(dates.map((d) => [d, 0]));
  for (const level of levels) {
    for (const unit of level.units) {
      for (const w of unit.words) {
        const c = s.srs[cardId(unit.id, w)];
        if (c) for (const d of dates) if (c.due <= d) out[d] += 1;
      }
    }
  }
  return out;
}

export function counts(levels) {
  const s = get();
  let total = 0;
  let learned = 0;
  for (const level of levels) {
    for (const unit of level.units) {
      for (const w of unit.words) {
        const c = s.srs[cardId(unit.id, w)];
        if (c) { total += 1; if (c.box >= 3) learned += 1; }
      }
    }
  }
  return { total, learned, due: dueCards(levels).length };
}
