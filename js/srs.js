import { get, update, today, ENGLISH_COURSES } from './store.js';

// Коробки Лейтнера: правильна відповідь — у наступну, помилка — назад у першу.
const INTERVALS = [0, 1, 2, 4, 8, 16, 32];

const addDays = (iso, n) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

// Колода — фрази (words) юнітів увімкнених курсів. Англійська зберігає ключ часів до курсів («a2-01:фраза»):
// інакше пристрій на старій версії й новий вели б дві різні картки однієї фрази.
// В інших курсах — з id курсу, бо id юнітів у різних курсах можуть збігатися.
const LEGACY = new Set(ENGLISH_COURSES);
export const cardId = (cid, unitId, word) => (LEGACY.has(cid) ? `${unitId}:${word.en}` : `${cid}/${unitId}:${word.en}`);

/** Усі фрази курсів: packs — [{id, pack}] (Courses.enabled()). */
function cards(packs) {
  const out = [];
  for (const { id: cid, pack } of packs) {
    for (const unit of pack.units) {
      for (const word of unit.words ?? []) out.push({ id: cardId(cid, unit.id, word), cid, unit, word });
    }
  }
  return out;
}

/** Фрази юніту потрапляють у повторення, щойно юніт відкрито. */
export function enroll(cid, unit) {
  if (!unit.words?.length) return;
  const s = get();
  if (unit.words.every((w) => s.srs[cardId(cid, unit.id, w)])) return;
  update((st) => {
    for (const w of unit.words) st.srs[cardId(cid, unit.id, w)] ||= { box: 0, due: today(), at: Date.now() };
  });
}

export function dueCards(packs) {
  const s = get();
  const t = today();
  return cards(packs).filter((c) => s.srs[c.id]?.due <= t).map((c) => ({ ...c, box: s.srs[c.id].box }));
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
export function dueForecast(packs, days = 7) {
  const s = get();
  const dates = Array.from({ length: days }, (_, i) => addDays(today(), i));
  const out = Object.fromEntries(dates.map((d) => [d, 0]));
  for (const { id } of cards(packs)) {
    const c = s.srs[id];
    if (c) for (const d of dates) if (c.due <= d) out[d] += 1;
  }
  return out;
}

export function counts(packs) {
  const s = get();
  let total = 0;
  let learned = 0;
  for (const { id } of cards(packs)) {
    const c = s.srs[id];
    if (c) { total += 1; if (c.box >= 3) learned += 1; }
  }
  return { total, learned, due: dueCards(packs).length };
}

/** Курси, по яких уже є картки (з іншого пристрою чи старої версії): їх варто встановити. */
export function courseIdsWithCards() {
  const ids = new Set();
  for (const key of Object.keys(get().srs)) {
    const slash = key.indexOf('/');
    const colon = key.indexOf(':');
    if (slash > 0 && slash < colon) ids.add(key.slice(0, slash));
    else if (LEGACY.has(`en-${key.slice(0, 2)}`)) ids.add(`en-${key.slice(0, 2)}`);
  }
  return [...ids];
}

// ---------- помилки тестів ----------
// Помилкова вправа стає карткою тієї ж колоди: ключ «курс/юніт:#q<відбиток>». Відбиток — з типу, питання,
// картинки й відповіді: дві вправи «А ця?» з різними малюнками — різні картки; змінене питання — нова картка.

const MISTAKE = ':#q';
function exHash(ex) {
  const s = `${ex.type}|${ex.q}|${ex.img ?? ''}|${JSON.stringify(ex.a)}|${JSON.stringify(ex.items ?? '')}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(36);
}
export const mistakeId = (cid, uid, ex) => `${cid}/${uid}${MISTAKE}${exHash(ex)}`;
export const isMistake = (id) => id.includes(MISTAKE);

/**
 * Відповідь у тесті теми. Помилка — картка на завтра (сьогодні людина щойно бачила відповідь).
 * Правильна відповідь на вправу, що вже чекає повторення, — зараховується як повторення.
 */
export function recordAnswer(cid, uid, ex, ok) {
  const id = mistakeId(cid, uid, ex);
  const c = get().srs[id];
  if (!ok) update((s) => { s.srs[id] = { box: 0, due: addDays(today(), 1), at: Date.now() }; });
  else if (c && c.due <= today()) grade(id, true);
}

/** Вправи з помилок, які сьогодні час повторити: [{...вправа, cid, uid, srsId, from}]. */
export function dueMistakes(packs) {
  const s = get();
  const t = today();
  const out = [];
  for (const { id: cid, pack } of packs) {
    for (const unit of pack.units) {
      for (const ex of unit.exercises ?? []) {
        const id = mistakeId(cid, unit.id, ex);
        if (s.srs[id]?.due <= t) out.push({ ...ex, cid, uid: unit.id, srsId: id, from: `${pack.title} · ${unit.title}` });
      }
    }
  }
  return out;
}

/** Помилки в колоді: усього (лише тих вправ, що досі є в курсах) і на сьогодні. */
export function mistakeCounts(packs) {
  const s = get();
  const t = today();
  let total = 0;
  let due = 0;
  for (const { id: cid, pack } of packs) {
    for (const unit of pack.units) {
      for (const ex of unit.exercises ?? []) {
        const c = s.srs[mistakeId(cid, unit.id, ex)];
        if (c) { total += 1; if (c.due <= t) due += 1; }
      }
    }
  }
  return { total, due };
}

/** Скільки помилок чекатиме на кожну дату тижня — окремо від фраз (dueForecast їх не рахує). */
export function mistakeForecast(packs, days = 7) {
  const s = get();
  const dates = Array.from({ length: days }, (_, i) => addDays(today(), i));
  const out = Object.fromEntries(dates.map((d) => [d, 0]));
  for (const { id: cid, pack } of packs) {
    for (const unit of pack.units) {
      for (const ex of unit.exercises ?? []) {
        const c = s.srs[mistakeId(cid, unit.id, ex)];
        if (c) for (const d of dates) if (c.due <= d) out[d] += 1;
      }
    }
  }
  return out;
}
