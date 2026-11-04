import * as S from './store.js';
import { esc, inline, blocksHtml } from './blocks.js';
import { mountTyping, keyboardHtml, handsHtml } from './typing.js';
import { mountQuiz } from './quiz.js';
import { lessons, exercisesFor, weakKeys, weakText, wordsText, textsText, THEORY, PASS_ACC } from './course.js';
import { detectLayout, LANG_NAMES } from './layouts.js';
import * as SRS from './srs.js';
import * as Sync from './sync.js';
import * as Bot from './bot.js';
import * as Courses from './courses.js';
import { iconSvg, uiSvg } from './icons.js';
import { wheelStrip } from './wheel.js';

const $ = (id) => document.getElementById(id);
const view = () => $('view');
const st = () => S.get();
const set = () => st().settings;

const TABS = { druk: 'kursy', lesson: 'kursy', free: 'kursy', kursy: 'kursy', kurs: 'kursy', k: 'kursy', pravopys: 'kursy', topic: 'kursy', english: 'kursy', unit: 'kursy', srs: 'kursy', mistakes: 'kursy', progress: 'progress', settings: 'settings' };

const PRAISE = ['Смачно! Буквоїд ситий.', 'Чисто, як у відмінника в зошиті.', 'Літери з\'їдено без кісточок.', 'Рівно й без поспіху — саме так.'];
const SCOLD = ['Буквоїд вдавився: забагато помилок. Повільніше — і ще раз.', 'Поспіх — ворог точності. Спробуйте на третину повільніше.', 'Пальці випередили голову. Пригальмуйте й повторіть.'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

const stars = (acc) => (acc >= 99.5 ? 3 : acc >= 98.5 ? 2 : acc >= PASS_ACC ? 1 : 0);
const starsHtml = (n) => `<span class="stars" aria-label="${n} з 3">${'★'.repeat(n)}<i>${'★'.repeat(3 - n)}</i></span>`;

const SPEAKER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>';

function speak(text) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-GB';
    u.rate = 0.9;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch { /* озвучення недоступне */ }
}

function head(title, back, sub = '') {
  return `<div class="page-head">${back ? `<a class="back" href="${back}" aria-label="Назад">‹</a>` : ''}<div><h1>${esc(title)}</h1>${sub ? `<div class="muted">${sub}</div>` : ''}</div></div>`;
}

// ---------- Друк ----------

function lessonState(id) {
  return st().typing[id] || { parts: {}, done: false };
}

function lessonStars(l) {
  const s = lessonState(l.id);
  const accs = ['a', 'b', 'c'].map((k) => s.parts[k]?.acc ?? 0);
  return s.done ? stars(Math.min(...accs)) : 0;
}

const nextLesson = (lang) => {
  const list = lessons(lang);
  return list.find((l) => !lessonState(l.id).done) || list[list.length - 1];
};

/** Стара вкладка «Друк» (#druk — закладки й посилання): тепер це курс друку останньої мови. */
const renderDruk = () => go(`kurs/druk-${set().lang}`);

// ---------- Друк як курс ----------

// Вбудовані курси друку: уроки будуються з розкладки (course.js), тому файлу курсу в них немає
const TYPING_COURSES = ['uk', 'en', 'ru'].map((lang) => ({ id: `druk-${lang}`, lang }));
const typingTitle = (lang) => `Друк наосліп · ${LANG_NAMES[lang]}`;
const typingOn = () => TYPING_COURSES.filter((c) => Courses.builtinOn(c.id));
const typingDone = (lang) => lessons(lang).filter((l) => lessonState(l.id).done).length;

/** На телефоні: друк наосліп — це фізична клавіатура; екранна клавіатура телефону вчить іншого. */
function touchNote() {
  if (!touchOnly()) return '';
  return '<aside class="callout note touch-note">Друк наосліп тренують на <b>фізичній клавіатурі</b>: відкрийте Буквоїд на комп’ютері або підключіть клавіатуру до планшета. Прогрес той самий, якщо ввімкнено синхронізацію. Тут можна прочитати поради й подивитися уроки.</aside>';
}

function renderTypingCourse(lang) {
  // Мова останнього відкритого курсу друку — для вільного тренування й старого #druk
  if (set().lang !== lang) S.update((s) => { s.settings.lang = lang; });
  const list = lessons(lang);
  const next = nextLesson(lang);
  const day = S.day(S.today());
  const weak = weakKeys(S.keyStats(lang));
  view().innerHTML = `
    ${head(typingTitle(lang), '#kursy', `${list.length} уроків: основний ряд → верхній → нижній → знаки й цифри → текст`)}
    ${touchNote()}
    <section class="hero">
      <div class="hero-main">
        <div class="hero-num">${day.chars}<small>букв з'їдено сьогодні</small></div>
        <div class="muted">${day.chars ? `${Math.round(day.ms / 60000)} хв · точність ${Math.round((day.chars / (day.chars + day.errors)) * 1000) / 10}%` : '15 хвилин на день досить.'}</div>
      </div>
      <a class="btn primary big" href="#lesson/${lang}/${next.n}">${lessonState(next.id).parts.a ? 'Продовжити' : 'Почати'}: урок ${next.n}</a>
    </section>
    <h2 class="section-title">Вільне тренування</h2>
    <div class="tiles">
      <a class="tile" href="#free/weak/${lang}"><b>Слабкі клавіші</b><span class="muted">${weak.length ? weak.slice(0, 5).map((w) => esc(w.ch)).join(' ') : 'з\'являться після кількох вправ'}</span></a>
      <a class="tile" href="#free/words/${lang}"><b>Слова</b><span class="muted">усі літери</span></a>
      <a class="tile" href="#free/texts/${lang}"><b>Текст</b><span class="muted">речення й прислів'я</span></a>
      <a class="tile" href="#free/own/${lang}"><b>Свій текст</b><span class="muted">вставте будь-що</span></a>
    </div>
    <h2 class="section-title">Перш ніж почати</h2>
    <div class="theory-list">
      ${THEORY.map((t) => `<details class="fold"${t.id === 'home' && !lessonState(list[0].id).done ? ' open' : ''}><summary>${esc(t.title)}</summary><div class="prose">${blocksHtml(t.blocks)}${t.id === 'home' ? handsHtml(lang) + keyboardHtml(lang, { zones: true }) : ''}</div></details>`).join('')}
    </div>
    <h2 class="section-title">Уроки</h2>
    <ol class="lessons">
      ${list.map((l) => {
        const s = lessonState(l.id);
        const parts = ['a', 'b', 'c'].filter((k) => (s.parts[k]?.acc ?? 0) >= PASS_ACC).length;
        return `<li><a href="#lesson/${lang}/${l.n}" class="${s.done ? 'done' : ''}${l === next ? ' current' : ''}">
          <span class="num">${l.n}</span>
          <span class="l-title">${esc(l.title)}${l.fresh.length ? `<span class="chips">${l.fresh.map((c) => `<kbd>${esc(c === ' ' ? '␣' : c.toUpperCase())}</kbd>`).join('')}</span>` : ''}</span>
          <span class="l-state">${s.done ? starsHtml(lessonStars(l)) : parts ? `${parts}/3` : ''}</span>
        </a></li>`;
      }).join('')}
    </ol>`;
}

function resultHtml(r, passed) {
  return `
    <div class="result ${passed ? 'pass' : 'fail'}" role="status">
      <div class="result-nums">
        <div><b>${r.acc}%</b><span>точність</span></div>
        <div><b>${r.cpm}</b><span>знаків/хв</span></div>
        <div><b>${r.rhythm ?? '—'}</b><span>рівність ритму</span></div>
        <div><b>${r.errors}</b><span>помилок</span></div>
      </div>
      <p>${passed ? pick(PRAISE) : pick(SCOLD)}</p>
    </div>`;
}

function renderLesson(lang, n) {
  const list = lessons(lang);
  const lesson = list[Number(n) - 1];
  if (!lesson) return go(`kurs/druk-${lang}`);
  const exs = exercisesFor(lang, lesson);
  const s = lessonState(lesson.id);
  let current = exs.find((e) => (s.parts[e.key]?.acc ?? 0) < PASS_ACC)?.key || 'a';

  const draw = () => {
    const state = lessonState(lesson.id);
    view().innerHTML = `
      ${head(`Урок ${lesson.n}. ${lesson.title}`, `#kurs/druk-${lang}`, lesson.fresh.length ? `Нові клавіші: ${lesson.fresh.map((c) => `<kbd>${esc(c.toUpperCase())}</kbd>`).join(' ')}` : esc(lesson.note || ''))}
      ${touchNote()}
      <div class="parts">
        ${exs.map((e) => {
          const p = state.parts[e.key];
          return `<button type="button" class="part${e.key === current ? ' on' : ''}${p && p.acc >= PASS_ACC ? ' ok' : ''}" data-part="${e.key}">${esc(e.title)}${p ? `<small>${p.acc}%</small>` : ''}</button>`;
        }).join('')}
      </div>
      <div id="typer"></div>
      <div id="after"></div>`;
    view().querySelectorAll('[data-part]').forEach((b) => { b.onclick = () => { current = b.dataset.part; draw(); }; });
    const ex = exs.find((e) => e.key === current);
    mountTyping($('typer'), {
      text: ex.text, lang, mode: set().mode, keyboard: set().keyboard,
      onDone: (r) => {
        S.recordSession({ lang, cid: `druk-${lang}`, ...r });
        const passed = r.acc >= PASS_ACC;
        const wasDone = lessonState(lesson.id).done;
        S.update((x) => {
          const t = (x.typing[lesson.id] ||= { parts: {}, done: false });
          const prev = t.parts[current];
          if (!prev || r.acc > prev.acc || (r.acc === prev.acc && r.cpm > prev.cpm)) t.parts[current] = { acc: r.acc, cpm: r.cpm };
          t.done = ['a', 'b', 'c'].every((k) => (t.parts[k]?.acc ?? 0) >= PASS_ACC);
        });
        if (!wasDone && lessonState(lesson.id).done) S.recordPassed(lesson.id);
        const nextPart = exs.find((e) => (lessonState(lesson.id).parts[e.key]?.acc ?? 0) < PASS_ACC);
        const done = lessonState(lesson.id).done;
        $('after').innerHTML = resultHtml(r, passed) + `<div class="row">
          <button type="button" class="btn${passed ? '' : ' primary'}" data-act="again">Ще раз <kbd>Enter</kbd></button>
          ${done && list[lesson.n] ? `<a class="btn primary" href="#lesson/${lang}/${lesson.n + 1}">Наступний урок</a>` : ''}
          ${!done && nextPart && passed ? `<button type="button" class="btn primary" data-act="next">Далі: ${esc(nextPart.title)}</button>` : ''}
        </div>${done ? '<p class="muted">Урок пройдено. Можна повертатися й покращувати зірки.</p>' : ''}`;
        const again = () => { Object.assign(ex, exercisesFor(lang, lesson).find((e) => e.key === current)); draw(); };
        $('after').querySelector('[data-act="again"]').onclick = again;
        const nx = $('after').querySelector('[data-act="next"]');
        if (nx) nx.onclick = () => { current = nextPart.key; draw(); };
        onEnterOnce(() => (nx && passed ? nx.click() : again()));
      },
    });
  };
  draw();
}

// Enter після результату — повторити або далі
function onEnterOnce(fn) {
  const h = (e) => {
    if (e.key !== 'Enter' || e.target.matches('input, textarea')) return;
    e.preventDefault();
    document.removeEventListener('keydown', h);
    fn();
  };
  setTimeout(() => document.addEventListener('keydown', h), 50);
  window.addEventListener('hashchange', () => document.removeEventListener('keydown', h), { once: true });
}

function cleanOwn(text) {
  return text.replace(/[“”«»„]/g, '"').replace(/[—–]/g, '-').replace(/…/g, '...').replace(/[ʼ’‘]/g, "'")
    .replace(/\s+/g, ' ').trim().slice(0, 2000);
}

function renderFree(kind, lang = set().lang) {
  if (!LANG_NAMES[lang]) lang = set().lang;
  const back = `#kurs/druk-${lang}`;
  const titles = { weak: 'Слабкі клавіші', words: 'Слова', texts: 'Текст', own: 'Свій текст' };
  if (!titles[kind]) return go(back.slice(1));
  const make = () => {
    if (kind === 'weak') return weakText(lang, weakKeys(S.keyStats(lang))) || wordsText(lang);
    if (kind === 'words') return wordsText(lang);
    if (kind === 'texts') return textsText(lang);
    return null;
  };
  let ownText = '';
  try { ownText = localStorage.getItem('bukvoid:own') || ''; } catch { /* приватний режим */ }

  const run = (text) => {
    view().innerHTML = `${head(titles[kind], back, kind === 'weak' && !weakKeys(S.keyStats(lang)).length ? 'Статистики ще мало — поки що звичайні слова' : LANG_NAMES[lang])}<div id="typer"></div><div id="after"></div>`;
    mountTyping($('typer'), {
      text, lang, mode: set().mode, keyboard: set().keyboard,
      onDone: (r) => {
        S.recordSession({ lang, cid: `druk-${lang}`, ...r });
        $('after').innerHTML = resultHtml(r, r.acc >= PASS_ACC) + `<div class="row"><button type="button" class="btn primary" data-act="again">${kind === 'own' ? 'Ще раз' : 'Новий текст'} <kbd>Enter</kbd></button>${kind === 'own' ? '<button type="button" class="btn" data-act="edit">Інший текст</button>' : ''}</div>`;
        const again = () => run(kind === 'own' ? text : make());
        $('after').querySelector('[data-act="again"]').onclick = again;
        const ed = $('after').querySelector('[data-act="edit"]');
        if (ed) ed.onclick = ask;
        onEnterOnce(again);
      },
    });
  };
  const ask = () => {
    view().innerHTML = `${head(titles.own, back, 'Вставте лист, код-рев\'ю чи статтю — тренуйтеся на тому, що реально друкуєте')}
      <form id="own-form" class="stack">
        <label class="field-label" for="own-text">Текст для тренування</label>
        <textarea id="own-text" rows="8">${esc(ownText)}</textarea>
        <div class="row"><button type="submit" class="btn primary">Друкувати</button><span class="muted">Розкладка: ${LANG_NAMES[lang].toLowerCase()}. Інша мова — у її курсі друку на вкладці «Курси».</span></div>
      </form>`;
    $('own-form').onsubmit = (e) => {
      e.preventDefault();
      const t = cleanOwn($('own-text').value);
      if (!t) return;
      ownText = t;
      try { localStorage.setItem('bukvoid:own', t); } catch { /* приватний режим */ }
      run(t);
    };
  };
  if (kind === 'own') ask(); else run(make());
}

// ---------- Курси ----------

// «Пройдено» — частка правильних не нижче pass курсу (англійська — 0.8, як до курсів; типово — без помилок)
const unitDone = (r, pack) => Boolean(r?.total) && r.best / r.total >= (pack?.pass ?? 1);
const courseProgress = (cid) => st().courses[cid] ?? {};

// Остання відкрита тема курсу — на цьому пристрої, як і поточний курс: тест міг ще не початися
const LAST_UNIT_KEY = 'bukvoid:last-unit:';
function lastUnitIndex(cid, pack) {
  let id = null;
  try { id = localStorage.getItem(LAST_UNIT_KEY + cid); } catch { /* приватний режим */ }
  const i = id ? pack.units.findIndex((u) => u.id === id) : -1;
  if (i >= 0) return i;
  // Тут курс ще не відкривали — тема з найсвіжішим тестом (результати тестів синхронізуються)
  const p = courseProgress(cid);
  let at = '';
  let last = -1;
  pack.units.forEach((u, k) => { const r = p[u.id]; if (r && (r.at || '') >= at) { at = r.at || ''; last = k; } });
  return last;
}

/**
 * Де зупинились: незакінчена остання тема — «Продовжити», закінчена — «Далі» на наступну непройдену.
 * { href, how, n, total, title, word, started } або null, якщо курсу немає.
 */
function resumeOf(cid) {
  const typing = TYPING_COURSES.find((c) => c.id === cid);
  if (typing) {
    const list = lessons(typing.lang);
    const l = nextLesson(typing.lang);
    const done = typingDone(typing.lang);
    const how = done === list.length ? 'Повторити' : lessonState(l.id).parts.a ? 'Продовжити' : done ? 'Далі' : 'Почати';
    return { href: `#lesson/${typing.lang}/${l.n}`, how, n: l.n, total: list.length, title: l.title, word: 'Урок',
      started: done > 0 || Boolean(lessonState(l.id).parts.a) };
  }
  const pack = Courses.get(cid);
  if (!pack?.units.length) return null;
  const p = courseProgress(cid);
  const undone = (k) => !unitDone(p[pack.units[k].id], pack);
  const last = lastUnitIndex(cid, pack);
  let i = last;
  let how = 'Продовжити';
  if (last < 0) {
    i = Math.max(0, pack.units.findIndex((u, k) => undone(k)));
    how = 'Почати';
  } else if (!undone(last)) {
    const ahead = pack.units.findIndex((u, k) => k > last && undone(k));
    const any = ahead >= 0 ? ahead : pack.units.findIndex((u, k) => undone(k));
    [i, how] = any >= 0 ? [any, 'Далі'] : [last, 'Повторити'];
  }
  const u = pack.units[i];
  return { href: `#k/${esc(cid)}/${esc(u.id)}`, how, n: i + 1, total: pack.units.length, title: u.title, word: 'Тема', started: last >= 0 };
}

/** Перший запуск (жодного курсу ще не відкривали й прогресу немає): що це за застосунок і з чого почати. */
function welcomeHero() {
  if (lastCourse()) return '';
  const s = st();
  const any = Object.keys(s.courses || {}).length || ['uk', 'en', 'ru'].some((l) => typingDone(l)) || SRS.counts(Courses.enabled()).total;
  if (any) return '';
  return `<section class="card welcome">
      <div class="eyebrow">Як тут вчитися</div>
      <p>Кожна тема курсу — <b>теорія, приклади й тест</b>. Помилки тесту повертаються на <b>повторення</b> наступного дня, потім через 2, 4, 8 днів — так знання переходять у довгу пам'ять. Фрази мовних курсів збираються в колоду.</p>
      <p>Відкрийте будь-який курс нижче або додайте новий з <button type="button" class="link" data-to-catalog>каталогу</button>. ${touchOnly() ? 'Друк наосліп тренують на клавіатурі комп’ютера.' : 'Друк наосліп — окремі курси з екранною клавіатурою.'}</p>
      <p class="muted small">Щоб прогрес був однаковий на телефоні й комп'ютері — ⚙ → «Google Диск».</p>
    </section>`;
}

/** Пристрій без фізичної клавіатури й миші (телефон, планшет): друк наосліп тут не потренуєш. */
const touchOnly = () => matchMedia('(hover: none) and (pointer: coarse)').matches;

/** «Де зупинились» угорі «Курсів»: останній відкритий курс і його тема — одним дотиком. */
function resumeHero() {
  const cid = lastCourse();
  const r = cid && resumeOf(cid);
  if (!r) return '';
  const typing = TYPING_COURSES.find((c) => c.id === cid);
  const pack = typing ? null : Courses.get(cid);
  return `<section class="hero resume">
      <span class="course-ico">${iconSvg(typing ? 'keyboard' : pack.icon)}</span>
      <div class="hero-main"><div class="eyebrow">Де зупинились</div>
      <b>${esc(typing ? typingTitle(typing.lang) : pack.title)}</b>
      <div class="muted">${r.word} ${r.n} з ${r.total} · ${esc(r.title)}</div></div>
      <a class="btn primary big" href="${r.href}">${r.how}</a>
    </section>`;
}

/** Колода повторення: показується, коли в увімкнених курсах є фрази. */
/** «Повторення»: фрази мовних курсів і помилки тестів — те, що сьогодні час повторити. */
function srsHero() {
  const packs = Courses.enabled();
  const c = SRS.counts(packs);
  const m = SRS.mistakeCounts(packs);
  if (!c.total && !m.total) return '';
  if (!c.due && !m.due) {
    return `<p class="srs-line"><span class="eyebrow">Повторення</span> <span class="muted">на сьогодні все${m.total ? ` · помилок у черзі ${m.total}` : ''}</span>${c.total ? ' <a href="#srs">Колода фраз</a>' : ''}</p>`;
  }
  const parts = [c.total && `фраз ${c.due}`, m.total && `помилок ${m.due}`].filter(Boolean).join(' · ');
  const buttons = [
    c.due && '<a class="btn primary" href="#srs">Фрази</a>',
    m.due && '<a class="btn primary" href="#mistakes">Помилки</a>',
  ].filter(Boolean).join('');
  return `<section class="hero srs-card">
      <div class="hero-main"><div class="eyebrow">Повторення</div>
      <div class="hero-num">${c.due + m.due}<small> на сьогодні</small></div>
      <div class="muted">${parts}</div></div>
      <div class="row">${buttons}</div>
    </section>`;
}

/** Помилки з тестів усіх курсів, яким настав день: той самий тест, зарахування — у колоду. */
function renderMistakes() {
  const packs = Courses.enabled();
  const due = SRS.dueMistakes(packs).sort(() => Math.random() - 0.5);
  if (!due.length) {
    view().innerHTML = `${head('Повторення помилок', '#kursy')}<div class="card quiz summary"><div class="big-score">0</div>
      <p>Сьогодні повторювати нічого. Вправа, на якій помилились у тесті, повертається наступного дня, потім через 2, 4, 8 днів…</p>
      <a class="btn primary" href="#kursy">До курсів</a></div>`;
    return;
  }
  view().innerHTML = `${head('Повторення помилок', '#kursy', `${due.length} на сьогодні — помилки з тестів тем`)}<div id="quiz" class="card"></div>`;
  mountQuiz($('quiz'), due, {
    src: (path, ex) => Courses.src(ex.cid)(path),
    onTime: (ms, ex) => S.recordStudyTime(ms, { cid: ex.cid }),
    onAnswer: (ex, ok) => SRS.grade(ex.srsId, ok),
  });
}

function courseTile({ id, href, icon, title, subtitle, done, started, total, word }) {
  const r = resumeOf(id);
  const cur = id === lastCourse();
  return `<a class="tile course-tile${cur ? ' current' : ''}" href="${href}">
        <span class="course-ico">${iconSvg(icon)}</span>
        <b>${esc(title)}</b>
        <span class="muted">${esc(subtitle || '')}</span>
        <span class="course-meter" aria-label="Пройдено ${done} з ${total}"><span style="width:${(done / total) * 100}%"></span></span>
        <small class="muted">${done ? `пройдено ${done} з ${total}` : started ? `почато ${started} з ${total}` : `${total} ${word}`}</small>
        ${r?.started && !cur ? `<small class="tile-next">${r.how === 'Повторити' ? 'усе пройдено' : `${r.how === 'Продовжити' ? 'зупинились' : 'далі'}: ${r.word.toLowerCase()} ${r.n} · ${esc(r.title)}`}</small>` : ''}</a>`;
}

function renderCourses() {
  const list = Courses.enabled();
  const typing = typingOn();
  const items = [
    ...typing.map(({ id, lang }) => {
      const ls = lessons(lang);
      return { id, href: `#kurs/${id}`, icon: 'keyboard', title: typingTitle(lang), subtitle: 'Уроки за розкладкою: клавіші, сполучення, слова',
        done: typingDone(lang), started: ls.filter((l) => lessonState(l.id).parts.a).length, total: ls.length, word: 'уроків' };
    }),
    ...list.map(({ id, pack }) => {
      const p = courseProgress(id);
      return { id, href: `#kurs/${esc(id)}`, icon: pack.icon, title: pack.title, subtitle: pack.subtitle,
        done: pack.units.filter((u) => unitDone(p[u.id], pack)).length, started: pack.units.filter((u) => p[u.id]).length, total: pack.units.length, word: 'тем' };
    }),
  ];
  // Спершу курс, де зупинились, далі розпочаті (менше лишилось — вище), далі нерозпочаті — у порядку з налаштувань
  const cur = lastCourse();
  const rank = (x) => (x.id === cur ? 0 : x.done >= x.total ? 2 : x.done || x.started ? 1 : 3);
  const tiles = items.map((x, i) => ({ x, i })).sort((a, b) => rank(a.x) - rank(b.x) || a.i - b.i).map(({ x }) => courseTile(x));
  view().innerHTML = `
    ${head('Курси', '', 'Теорія, тест, повторення помилок і практика — тема за темою')}
    ${resumeHero() || welcomeHero()}
    ${srsHero()}
    <h2 class="section-title">Мої курси</h2>
    <div class="tiles courses" id="kursy-tiles">${tiles.join('')}</div>
    ${tiles.length ? '' : '<p class="muted" id="kursy-empty">Усі курси сховані — покажіть їх у ⚙ → «Курси» або додайте з каталогу.</p>'}
    <section id="kursy-catalog" hidden><h2 class="section-title">Каталог <span class="muted">торкніться, щоб додати</span></h2>
    <div class="tiles courses" id="catalog-tiles"></div></section>
    <a class="btn" href="#settings/courses">Керувати курсами, курс із файлу</a>`;
  addCatalogTiles($('catalog-tiles'));
  view().querySelector('[data-to-catalog]')?.addEventListener('click', () => $('kursy-catalog')?.scrollIntoView({ behavior: 'smooth' }));
}

/** Курси каталогу, яких ще немає на пристрої, — блідими плитками в тій самій сітці; торкнулись — курс додається. */
async function addCatalogTiles(grid) {
  const cat = await Courses.catalog();
  if (!grid.isConnected || !cat) return;
  const fresh = cat.filter((c) => !Courses.get(c.id));
  if (fresh.length) grid.closest('section')?.removeAttribute('hidden');
  grid.insertAdjacentHTML('beforeend', fresh.map((c) => `<button type="button" class="tile course-tile add" data-course-add="${esc(c.id)}">
      <span class="course-ico">${iconSvg(c.icon)}</span>
      <b>${esc(c.title)}</b>
      <span class="muted">${esc(c.subtitle || '')}</span>
      <small class="add-label">${c.units ? `${c.units} тем · ` : ''}<span>Додати</span></small>
    </button>`).join(''));
  grid.querySelectorAll('[data-course-add]').forEach((b) => {
    b.onclick = async () => {
      b.disabled = true;
      b.querySelector('.add-label span').textContent = 'Додаємо…';
      try {
        await Courses.install(b.dataset.courseAdd);
        if (grid.isConnected) renderCourses();
      } catch (err) {
        b.querySelector('.add-label').innerHTML = `<span class="errors">Не вдалося: ${esc(err.message)}</span>`;
        b.disabled = false;
      }
    };
  });
}

function renderCourse(cid, focus) {
  const typing = TYPING_COURSES.find((c) => c.id === cid);
  if (typing) return renderTypingCourse(typing.lang);
  const pack = Courses.get(cid);
  if (!pack) return go('kursy');
  const p = courseProgress(cid);
  const res = resumeOf(cid);
  const done = pack.units.filter((u) => unitDone(p[u.id], pack)).length;
  view().innerHTML = `
    ${head(pack.title, '#kursy', esc(pack.subtitle || ''))}
    ${res ? `<section class="hero">
      <div class="hero-main">
        <div class="hero-num">${done}<small>з ${pack.units.length} тем пройдено</small></div>
        <div class="muted">${res.how === 'Продовжити' ? 'Зупинились на темі' : res.how === 'Повторити' ? 'Усе пройдено. Остання тема' : 'Наступна тема'} ${res.n}: ${esc(res.title)}</div>
      </div>
      <a class="btn primary big" href="${res.href}">${res.how}: тема ${res.n}</a>
    </section>` : ''}
    ${mistakesLine(cid, pack)}
    <ol class="lessons topics">
      ${pack.units.map((u, i) => {
        const r = p[u.id];
        return `<li><a href="#k/${esc(cid)}/${esc(u.id)}" class="${unitDone(r, pack) ? 'done' : ''}${res && i === res.n - 1 ? ' current' : ''}">
          <span class="num">${i + 1}</span>
          <span class="l-title">${esc(u.title)}<span class="muted small">${esc(u.topic || u.source || '')}</span></span>
          <span class="l-state">${r ? `${r.best}/${r.total}` : ''}${tasksState(cid, u)}</span></a></li>`;
      }).join('')}
    </ol>
    ${pack.reference?.length ? `<h2 class="section-title" id="course-ref">Довідник</h2>${pack.reference.map((r) => `<details class="fold ref" id="ref-${esc(r.id)}"><summary>${esc(r.title)}</summary><div class="prose">${blocksHtml(r.theory, { src: Courses.src(cid) })}</div></details>`).join('')}` : ''}
    ${pack.source?.url ? `<p class="muted small">Джерело: <a href="${esc(pack.source.url)}" target="_blank" rel="noopener">${esc(pack.source.title || pack.source.url)}</a></p>` : ''}`;
  if (focus === 'ref') $('course-ref')?.scrollIntoView();
}

/** «✓ 2/4 завд.» у списку тем — скільки практичних завдань теми виконано. */
function tasksState(cid, u) {
  if (!u.tasks?.length) return '';
  const n = u.tasks.filter((_, i) => S.taskDone(S.taskKey(cid, u.id, i))).length;
  return `<small class="tasks-state${n === u.tasks.length ? ' all' : ''}">${n === u.tasks.length ? '✓ ' : ''}завд. ${n}/${u.tasks.length}</small>`;
}

/** Помилки тестів цього курсу, яким настав день повторення. */
function mistakesLine(cid, pack) {
  const m = SRS.mistakeCounts([{ id: cid, pack }]);
  if (!m.total) return '';
  return `<div class="card mistakes-line"><span>Помилки цього курсу: <b>${m.due}</b> на сьогодні · усього ${m.total}</span>${m.due ? '<a class="btn primary" href="#mistakes">Повторити</a>' : ''}</div>`;
}

function examplesHtml(list) {
  return `<div class="examples">${list.map((x) => (typeof x === 'string' ? `<span class="ex"><span>${inline(x)}</span></span>` : `<span class="ex" title="${esc(x.note || '')}"><span>${inline(x.w)}</span>${x.note ? `<small>${inline(x.note)}</small>` : ''}</span>`)).join('')}</div>`;
}

/** Пара «англійською — українською»; озвучення — лише в англійських курсах. */
function pairHtml(en, uk, say, lang) {
  return `<div class="pair">${lang === 'en' ? `<button type="button" class="say" data-say="${esc(say)}" aria-label="Озвучити">${SPEAKER}</button>` : ''}<span class="en">${en}</span><span class="uk muted">${uk}</span></div>`;
}

function renderCourseUnit(cid, uid) {
  const pack = Courses.get(cid);
  const i = pack ? pack.units.findIndex((u) => u.id === uid) : -1;
  if (i < 0) return go(pack ? `kurs/${cid}` : 'kursy');
  const t = pack.units[i];
  const next = pack.units[i + 1];
  const lang = pack.lang || 'uk';
  try { localStorage.setItem(LAST_UNIT_KEY + cid, uid); } catch { /* приватний режим */ }
  SRS.enroll(cid, t);
  const pairs = t.examples?.length && t.examples.every((x) => x && typeof x === 'object' && x.en);
  // Зміст — для довгих тем, де, крім правила й тесту, є фрази чи відео
  // «Правило» — у мовних курсах; в інших — «Теорія»
  const ruleWord = cid === S.SPELLING_COURSE || lang === 'en' ? 'Правило' : 'Теорія';
  const toc = [['u-theory', ruleWord], t.examples?.length && ['u-examples', 'Приклади'], t.words?.length && ['u-words', 'Фрази'],
    t.media?.length && ['u-media', 'Відео й аудіо'], t.exercises.length && ['u-test', 'Тест'], t.tasks?.length && ['u-tasks', 'Завдання'], pack.reference?.length && [`kurs/${esc(cid)}/ref`, 'Довідник'], t.typing?.length && ['u-typing', 'Друк']].filter(Boolean);
  view().innerHTML = `
    ${head(t.title, `#kurs/${esc(cid)}`, esc(t.topic ? `${t.topic} · ${pack.title}` : t.goal || ''))}
    ${t.topic && t.goal ? `<p class="goal">${inline(t.goal)}</p>` : ''}
    ${t.words?.length || t.media?.length || t.tasks?.length || pack.reference?.length ? `<nav class="toc">${toc.map(([id, label]) => `<a href="#${id}"${id.includes('/') ? ' data-route' : ''}>${label}</a>`).join('')}</nav>` : ''}
    <article class="prose card" id="u-theory">${blocksHtml(t.theory, { src: Courses.src(cid), sections: true })}</article>
    ${t.examples?.length ? `<h2 class="section-title" id="u-examples">Приклади</h2>${pairs
    ? `<div class="card pairs">${t.examples.map((x) => pairHtml(inline(x.en), inline(x.uk), x.en, lang)).join('')}</div>`
    : examplesHtml(t.examples)}` : ''}
    ${t.words?.length ? `<h2 class="section-title" id="u-words">Фрази теми <span class="muted">уже в колоді повторення</span></h2>
    <div class="card pairs">${t.words.map((w) => pairHtml(`<b>${esc(w.en)}</b>${w.ex ? `<small>${esc(w.ex)}</small>` : ''}`, esc(w.uk), w.ex || w.en, lang)).join('')}</div>` : ''}
    ${t.media?.length ? `<h2 class="section-title" id="u-media">Відео й матеріали</h2><div class="media">${[...t.media].sort((a, b) => Boolean(b.main) - Boolean(a.main)).map((m) => `<a class="tile${m.main ? ' main' : ''}" href="${esc(m.url)}" target="_blank" rel="noopener"><b>${m.main ? 'Головне джерело · ' : ''}${mediaLabel(m)} · ${esc(m.title)}</b>${m.note ? `<span class="muted">${esc(m.note)}</span>` : ''}</a>`).join('')}</div>` : ''}
    ${t.exercises.length ? '<h2 class="section-title" id="u-test">Тест</h2><div id="quiz" class="card"></div>' : ''}
    ${t.tasks?.length ? tasksHtml(cid, t) : ''}
    <h2 class="section-title" id="u-typing">${lang === 'en' ? 'Надрукуйте фрази' : cid === S.SPELLING_COURSE ? 'Надрукуйте правильно' : 'Надрукуйте головне'}</h2>
    <div id="typer" class="card"></div><div id="after"></div>
    ${next ? `<a class="btn next-topic" href="#k/${esc(cid)}/${esc(next.id)}">Наступна тема: ${esc(next.title)} ›</a>` : ''}`;
  view().querySelectorAll('[data-say]').forEach((b) => { b.onclick = () => speak(b.dataset.say); });
  const all = view().querySelector('[data-sec-all]');
  if (all) {
    all.onclick = () => {
      const secs = [...view().querySelectorAll('details.sec')];
      const open = !secs.every((d) => d.open);
      secs.forEach((d) => { d.open = open; });
      all.textContent = open ? 'Згорнути все' : 'Розгорнути все';
    };
  }
  view().querySelectorAll('.toc a:not([data-route])').forEach((a) => {
    a.onclick = (e) => { e.preventDefault(); document.querySelector(a.getAttribute('href'))?.scrollIntoView({ behavior: 'smooth' }); };
  });
  if (t.exercises.length) {
    mountQuiz($('quiz'), t.exercises, {
      src: Courses.src(cid),
      onAnswer: (ex, ok) => SRS.recordAnswer(cid, t.id, ex, ok),
      onTime: (ms) => S.recordStudyTime(ms, { cid }),
      pass: pack.pass ?? 1,
      next: next && { href: `#k/${esc(cid)}/${esc(next.id)}`, title: next.title },
      onDone: (score, total) => {
        S.recordUnit(cid, t.id, score, total);
        S.recordTest(`c:${cid}/${t.id}`, score, total);
      },
    });
  }
  typingBlock(t.typing, lang, cid);
  view().querySelectorAll('[data-task]').forEach((c) => {
    c.onchange = () => {
      S.setTask(c.dataset.task, c.checked);
      c.closest('li').classList.toggle('done', c.checked);
      const all = view().querySelectorAll('[data-task]');
      $('tasks-count').textContent = `${[...all].filter((x) => x.checked).length} з ${all.length}`;
    };
  });
}

/** Практичні завдання теми: робота руками поза застосунком; позначки синхронізуються. */
function tasksHtml(cid, t) {
  const keys = t.tasks.map((_, i) => S.taskKey(cid, t.id, i));
  const done = keys.filter(S.taskDone).length;
  return `<h2 class="section-title" id="u-tasks">Завдання на практиці <span class="muted" id="tasks-count">${done} з ${keys.length}</span></h2>
    <ul class="card tasks">${t.tasks.map((x, i) => `<li class="${S.taskDone(keys[i]) ? 'done' : ''}"><label><input type="checkbox" data-task="${esc(keys[i])}"${S.taskDone(keys[i]) ? ' checked' : ''}><span>${inline(x)}</span></label></li>`).join('')}</ul>`;
}

/** Друк речень теми: закріплює і правопис, і руку. */
function typingBlock(sentences, lang, cid) {
  if (!sentences?.length) { $('typer').closest('.card').remove(); return; }
  const start = () => mountTyping($('typer'), {
    text: sentences.join(' '), lang, mode: set().mode, keyboard: false,
    onDone: (r) => {
      S.recordSession({ lang, cid, ...r });
      $('after').innerHTML = resultHtml(r, r.acc >= PASS_ACC) + '<div class="row"><button type="button" class="btn" data-act="again">Ще раз</button></div>';
      $('after').querySelector('[data-act="again"]').onclick = () => { $('after').innerHTML = ''; start(); };
    },
  });
  // Не перехоплюємо фокус, поки людина читає теорію: друк стартує по кліку
  $('typer').innerHTML = `<button type="button" class="btn primary" id="start-typing">Почати друк · ${sentences.length} речень</button>`;
  $('start-typing').onclick = start;
}

// ---------- Повторення фраз ----------

// Відео — лише YouTube; сторінки British Council чи BBC — це уроки з текстом і тестом
const mediaLabel = (m) => (m.kind === 'audio' ? 'Аудіо' : /youtube\.com|youtu\.be/.test(m.url) ? 'Відео' : 'Урок онлайн');

function maskPhrase(ex, en) {
  if (!ex) return '';
  const words = en.split(/\s+/);
  let out = ex;
  for (const w of words) if (w.length > 2) out = out.replace(new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\w*`, 'i'), '…');
  return out;
}

function renderSrs() {
  const packs = Courses.enabled();
  const queue = SRS.dueCards(packs).sort(() => Math.random() - 0.5);
  const graded = new Set();
  let done = 0;
  let ok = 0;
  const show = () => {
    const card = queue[0];
    if (!card) {
      const c = SRS.counts(packs);
      view().innerHTML = `${head('Повторення фраз', '#kursy')}<div class="card quiz summary">
        <div class="big-score">${done ? `${ok}<small> / ${done}</small>` : '0'}</div>
        <p>${done ? 'На сьогодні все. Наступні фрази повернуться в потрібний день — так вони переходять у довгу пам\'ять.' : c.total ? 'Сьогодні повторювати нічого. Завтра колода покаже нові.' : 'Колода порожня: фрази додаються з тем мовних курсів, щойно ви їх відкриєте.'}</p>
        <a class="btn primary" href="#kursy">До курсів</a></div>`;
      return;
    }
    view().innerHTML = `${head('Повторення фраз', '#kursy', `лишилось ${queue.length} · коробка ${card.box + 1} з 7`)}
      <div class="card quiz">
        <div class="q-meta muted">${esc(card.unit.title)}</div>
        <div class="q-text">${esc(card.word.uk)}</div>
        ${card.word.ex ? `<p class="muted">${esc(maskPhrase(card.word.ex, card.word.en))}</p>` : ''}
        <form class="q-form" id="srs-form"><input class="q-input" id="srs-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="англійською" aria-label="Фраза англійською"><button type="submit" class="btn primary">Перевірити</button><button type="button" class="btn" id="srs-skip">Не пам’ятаю</button></form>
        <div class="q-feedback" id="srs-fb" hidden></div>
      </div>`;
    const input = $('srs-input');
    const shownAt = Date.now();
    input.focus();
    // «Не пам’ятаю» — чесна відповідь «не знаю»: фраза рахується помилкою й повертається в чергу
    let giveUp = false;
    $('srs-skip').onclick = () => { giveUp = true; $('srs-form').requestSubmit(); };
    $('srs-form').onsubmit = (e) => {
      e.preventDefault();
      const given = input.value.trim();
      if (!given && !giveUp) return;
      $('srs-skip').hidden = true;
      const right = normalizeLoose(given) === normalizeLoose(card.word.en);
      input.disabled = true;
      input.classList.add(right ? 'good' : 'bad');
      SRS.grade(card.id, right);
      // «Повторено N фраз» — фрази, а не спроби: помилкова повертається в чергу, але рахується раз
      S.recordStudyTime(Date.now() - shownAt, { srs: !graded.has(card.id), cid: card.cid });
      graded.add(card.id);
      done += 1;
      if (right) ok += 1;
      queue.shift();
      if (!right) queue.push({ ...card, box: 0 });
      const fb = $('srs-fb');
      fb.hidden = false;
      fb.className = `q-feedback ${right ? 'good' : 'bad'}`;
      fb.innerHTML = `<b>${right ? 'Так' : 'Правильно'}: ${esc(card.word.en)}</b>${card.word.ex ? `<p>${esc(card.word.ex)}</p>` : ''}
        <div class="row"><button type="button" class="btn primary" id="srs-next">Далі <kbd>Enter</kbd></button><button type="button" class="say" data-say="${esc(card.word.ex || card.word.en)}" aria-label="Озвучити">${SPEAKER}</button></div>`;
      fb.querySelector('[data-say]').onclick = (ev) => speak(ev.currentTarget.dataset.say);
      $('srs-next').onclick = show;
      $('srs-next').focus();
    };
  };
  show();
}

const normalizeLoose = (s) => s.toLowerCase().replace(/[ʼ’`‘]/g, "'").replace(/^to /, '').replace(/[.,!?;:]/g, '').replace(/\s+/g, ' ').trim();

// ---------- Прогрес ----------

function renderProgress() {
  const s = st();
  const tot = S.totals();
  const days = [];
  for (let i = 13; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = S.dayKey(d);
    const x = S.day(key);
    days.push({ key, label: d.getDate(), min: Math.round((x.ms + x.qms) / 60000) });
  }
  const max = Math.max(1, ...days.map((d) => d.min));
  const week = days.slice(-7).reduce((n, d) => n + d.min, 0);
  const langs = ['uk', 'en', 'ru'];
  const packs = Courses.enabled();
  const c = SRS.counts(packs);
  const typingLangs = langs.filter((l) => Courses.builtinOn(`druk-${l}`) || typingDone(l));
  const typing = tot.chars > 0 || typingLangs.length;
  const courseRow = ({ id, pack }) => {
    const topics = pack.units.filter((u) => unitDone(s.courses[id]?.[u.id], pack)).length;
    const tasks = pack.units.flatMap((u) => (u.tasks ?? []).map((_, i) => S.taskKey(id, u.id, i)));
    const tdone = tasks.filter((k) => S.taskDone(k)).length;
    const m = SRS.mistakeCounts([{ id, pack }]);
    const bits = [`тем ${topics}/${pack.units.length}`, tasks.length && `завдань ${tdone}/${tasks.length}`, m.total && `помилок ${m.due} на сьогодні з ${m.total}`].filter(Boolean);
    return `<a class="li" href="#kurs/${id}"><span>${esc(pack.title)}<small class="muted">${bits.join(' · ')}</small></span><b>${Math.round((topics / Math.max(1, pack.units.length)) * 100)}%</b></a>`;
  };
  view().innerHTML = `
    ${head('Прогрес', '')}
    <div class="stat-grid">
      <div class="stat"><b>${week}</b><span>хвилин навчання за 7 днів</span></div>
      <div class="stat"><b>${packs.reduce((n, { id, pack }) => n + pack.units.filter((u) => unitDone(s.courses[id]?.[u.id], pack)).length, 0)}</b><span>тем пройдено</span></div>
    </div>
    <h2 class="section-title">Останні 14 днів</h2>
    <div class="card bars" role="img" aria-label="Хвилин навчання за день">
      ${days.map((d) => `<div class="bar" title="${d.key}: ${d.min} хв"><span style="height:${(d.min / max) * 100}%"></span><small>${d.label}</small></div>`).join('')}
    </div>
    <h2 class="section-title">Курси</h2>
    <div class="card list progress-courses">
      ${packs.map(courseRow).join('') || '<p class="muted">Додайте курс у «Курсах» — тут з’явиться, скільки тем і завдань пройдено.</p>'}
      ${c.total ? `<div class="li"><span>Фрази в колоді</span><b>${c.learned} вивчено з ${c.total}</b></div>` : ''}
    </div>
    ${typing ? `<h2 class="section-title">Друк наосліп</h2>
    <div class="stat-grid">
      <div class="stat"><b>${tot.chars.toLocaleString('uk')}</b><span>букв з'їдено</span></div>
      <div class="stat"><b>${Math.round(tot.ms / 60000)}</b><span>хвилин друку</span></div>
      <div class="stat"><b>${tot.bestCpm}</b><span>найкраща швидкість, зн/хв</span></div>
      <div class="stat"><b>${tot.sessions}</b><span>вправ</span></div>
    </div>
    ${typingLangs.length ? `<div class="card list">${typingLangs.map((l) => `<div class="li"><span>${esc(typingTitle(l))}</span><b>${typingDone(l)}/${lessons(l).length}</b></div>`).join('')}</div>` : ''}
    <h3 class="section-title">Слабкі клавіші</h3>
    ${langs.map((l) => {
      const w = weakKeys(S.keyStats(l), 8);
      if (!w.length) return '';
      return `<div class="card"><div class="muted">${LANG_NAMES[l]}</div><div class="table-wrap"><table class="weak"><thead><tr><th>Клавіша</th><th>Помилок</th><th>Сер. час</th></tr></thead><tbody>
        ${w.map((k) => `<tr><td><kbd>${esc(k.ch === ' ' ? '␣' : k.ch)}</kbd></td><td>${Math.round(k.rate * 100)}%</td><td>${Math.round(k.ms)} мс</td></tr>`).join('')}
      </tbody></table></div></div>`;
    }).join('') || '<p class="muted">З’являться після кількох вправ.</p>'}` : ''}`;
}

// ---------- Налаштування ----------

const SET_OPEN_KEY = 'bukvoid:set-open';
const SIZES = [['s', 'Менший', 0.9], ['m', 'Звичайний', 1], ['l', 'Більший', 1.12], ['xl', 'Великий', 1.25]];
// Спецрежими — як у Shooter's Log і Хобі-плані: Нічна (усе червоним) і монітори-кінескопи
const THEMES = [['auto', 'Як у системі'], ['dark', 'Темна'], ['light', 'Світла'], ['night', 'Нічна'], ['phosphor', 'Фосфор'], ['amber', 'Бурштин'], ['white', 'Білий фосфор']];
const SPECIAL_THEMES = ['night', 'phosphor', 'amber', 'white'];
// Фон під картками — як у Shooter's Log, без камуфляжів: свій набір для темної й світлої теми, перший (без малюнка) — за
// замовчуванням; у спецрежимах фону немає. Вибір — лише на цьому пристрої
const BACKDROPS = {
  dark: [['plain', 'Без малюнка'], ['map', 'Карта'], ['olive', 'Олива'], ['carbon', 'Карбон'], ['coyote', 'Койот'], ['lines', 'Лінії'], ['lines-acc', 'Лінії з акцентом']],
  light: [['l-plain', 'Без малюнка'], ['l-map', 'Карта'], ['l-mm', 'Міліметрівка'], ['l-sand', 'Пісок'], ['l-sand-acc', 'Пісок з акцентом'], ['l-khaki', 'Хакі'], ['l-khaki-acc', 'Хакі з акцентом']],
};
const BG_KEY = { dark: 'bukvoid:bg', light: 'bukvoid:bg-light' };

function backdropPref(theme) {
  const list = BACKDROPS[theme];
  if (!list) return null;
  let v = null;
  try { v = localStorage.getItem(BG_KEY[theme]); } catch { /* приватний режим */ }
  return list.some(([k]) => k === v) ? v : list[0][0];
}

function openRow() {
  try { return localStorage.getItem(SET_OPEN_KEY) || ''; } catch { return ''; }
}

/**
 * Рядок налаштувань: значок, назва й поточне значення — видно, що де стоїть, нічого не відкриваючи.
 * Тап розгортає керування під рядком; відкритий завжди один і пам'ятається між екранами.
 */
function setRow(key, ico, title, value, body, { danger = false } = {}) {
  const open = openRow() === key;
  return `
    <div class="set-row${open ? ' open' : ''}${danger ? ' danger' : ''}" id="row-${key}" data-row="${key}">
      <button type="button" class="set-head" aria-expanded="${open}">
        <span class="course-ico small">${uiSvg(ico)}</span><span class="set-title">${title}</span>
        <span class="set-val" id="val-${key}">${value}</span><span class="set-chev" aria-hidden="true">›</span>
      </button>
      <div class="set-body"${open ? '' : ' inert'}><div class="set-inner"><div class="set-pane stack">${body}</div></div></div>
    </div>`;
}

/** Група: підпис над карткою, всередині — рядки через лінію. */
const setGroup = (title, rows) => `<h2 class="section-title">${title}</h2><div class="card set-list">${rows.join('')}</div>`;

function mountRows() {
  view().querySelectorAll('.set-row').forEach((row) => {
    row.querySelector('.set-head').onclick = () => {
      const opening = !row.classList.contains('open');
      view().querySelectorAll('.set-row.open').forEach((r) => setOpen(r, false));
      setOpen(row, opening);
      try { localStorage.setItem(SET_OPEN_KEY, opening ? row.dataset.row : ''); } catch { /* приватний режим */ }
    };
  });
}

function setOpen(row, open) {
  row.classList.toggle('open', open);
  row.querySelector('.set-head').setAttribute('aria-expanded', String(open));
  row.querySelector('.set-body').inert = !open;
}

/** Значення рядка й крапка стану: ok — працює, bad — треба втрутитись. */
function setVal(key, text, tone = '') {
  const el = $(`val-${key}`);
  if (!el) return;
  el.textContent = text;
  el.className = `set-val${tone ? ` ${tone}` : ''}`;
}

/** Час обміну для рядка: сьогодні — година, раніше — дата. */
function shortWhen(ts) {
  const d = new Date(ts);
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString('uk', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('uk', { day: 'numeric', month: 'short' });
}

const prefLabels = (s) => ({
  mode: s.mode === 'flow' ? 'Без зупинки' : 'Зупинка',
  keyboard: s.keyboard ? 'Показувати' : 'Сховано',
  size: SIZES.find(([v]) => v === (s.fontSize || 'm'))[1],
  theme: THEMES.find(([v]) => v === s.theme)?.[1] ?? 'Як у системі',
});

/** «Фон» під картками: стрічка плиток із самим фоном; набір — для поточної теми, у спецрежимах рядка немає. */
function backdropRow() {
  const theme = document.documentElement.dataset.theme;
  const list = BACKDROPS[theme];
  if (!list) return '';
  const now = backdropPref(theme);
  return setRow('backdrop', 'gallery', 'Фон', list.find(([k]) => k === now)[1], `
        <div class="bg-wheel">
          <button type="button" class="bg-nav" data-dir="-1" aria-label="Попередній фон">‹</button>
          <div class="bg-picks" role="radiogroup" aria-label="Фон">${list.map(([k, name]) => `<button type="button" class="bg-pick" role="radio" aria-checked="${k === now}" data-bg="${k}"><span class="bg-sw" data-bg="${k}"></span><span>${name}</span></button>`).join('')}</div>
          <button type="button" class="bg-nav" data-dir="1" aria-label="Наступний фон">›</button>
        </div>`);
}

/** Стрічка фонів — як стрічка цілей в Shooter's Log: фон посередині вибраний і одразу під картками, гортаєш — бачиш наживо. */
function mountBackdrop() {
  const strip = view().querySelector('.bg-picks');
  if (!strip) return;
  const theme = document.documentElement.dataset.theme;
  const list = BACKDROPS[theme];
  let now = backdropPref(theme);
  const wheel = wheelStrip(strip, (b) => {
    if (b.dataset.bg === now) return;
    now = b.dataset.bg;
    try { localStorage.setItem(BG_KEY[theme], now); } catch { /* приватний режим */ }
    strip.querySelectorAll('.bg-pick').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    applyTheme();
    // Без перемальовування — інакше стрічка злетіла б посеред гортання; назву в рядку міняємо на місці
    setVal('backdrop', list.find(([k]) => k === now)[1]);
  });
  strip.querySelectorAll('.bg-pick').forEach((b) => { b.onclick = () => wheel.centerOn(b); });
  // «‹ ›» по краях — видно, що стрічку гортають
  view().querySelectorAll('.bg-nav').forEach((b) => {
    b.onclick = () => {
      const on = strip.querySelector('[aria-checked="true"]');
      const to = Number(b.dataset.dir) < 0 ? on?.previousElementSibling : on?.nextElementSibling;
      if (to) wheel.centerOn(to);
    };
  });
  // Поля й вибраний посередині рахуються від ширини стрічки: поки її не видно, досчитуємо, щойно з'явиться
  let width = 0;
  new ResizeObserver(() => {
    if (!strip.clientWidth || strip.clientWidth === width) return;
    width = strip.clientWidth;
    wheel.settle(strip.querySelector('[aria-checked="true"]'));
  }).observe(strip);
}

function renderSettings(section) {
  const s = set();
  // Посилання #settings/courses відкриває одразу «Курси»
  if (section === 'courses') { try { localStorage.setItem(SET_OPEN_KEY, 'courses'); } catch { /* приватний режим */ } }
  const radio = (name, value, label, cur) => `<label class="opt"><input type="radio" name="${name}" value="${value}"${cur === value ? ' checked' : ''}> ${label}</label>`;
  const v = prefLabels(s);
  view().innerHTML = `
    ${head('Налаштування', '')}
    ${setGroup('Навчання', [
    setRow('courses', 'book', 'Курси', '', `
        <div id="courses-installed" class="stack"></div>
        <p class="muted small">Нові курси — у розділі «Каталог» на вкладці <a href="#kursy">«Курси»</a>: торкніться плитки — курс додано.</p>
        <div class="row"><label class="btn">Додати курс із файлу<input type="file" id="course-file" accept="application/json,.json,application/zip,.zip" hidden></label></div>
        <div id="courses-msg" class="muted" role="status"></div>
        <p class="muted small">Курс — файл .json у форматі Буквоїда: теорія, приклади, тест, друк. Курс із файлу живе лише на цьому пристрої; прогрес за ним синхронізується, як і решта.</p>`)])}
    ${setGroup('Друк наосліп', [
    setRow('mode', 'stop', 'Помилки під час друку', v.mode, `
        ${radio('mode', 'stop', '<b>Зупинка на помилці</b> — далі лише після правильної клавіші (радимо)', s.mode)}
        ${radio('mode', 'flow', '<b>Без зупинки</b> — помилку позначено, текст іде далі, Backspace повертає', s.mode)}`),
    setRow('keyboard', 'keyboard', 'Клавіатура на екрані', v.keyboard,
      `<label class="opt"><input type="checkbox" name="keyboard"${s.keyboard ? ' checked' : ''}> Показувати з підсвіткою наступної клавіші</label>
       <p class="muted small">На вузькому екрані (телефон) клавіатуру не показано — їй бракує місця.</p>`)])}
    ${setGroup('Вигляд', [
    setRow('size', 'type', 'Розмір тексту', v.size, `
        <div class="seg seg-size" role="radiogroup" aria-label="Розмір тексту">
          ${SIZES.map(([val, label, k]) => `<label class="size-opt${(s.fontSize || 'm') === val ? ' on' : ''}"><input type="radio" name="fontSize" value="${val}"${(s.fontSize || 'm') === val ? ' checked' : ''}><span style="font-size:${Math.round(18 * k * k)}px">Аа</span><small>${label}</small></label>`).join('')}
        </div>`),
    setRow('theme', 'palette', 'Тема', v.theme, `
        ${THEMES.filter(([val]) => !SPECIAL_THEMES.includes(val)).map(([val, label]) => radio('theme', val, label, s.theme)).join('')}
        <h3 class="sub-title">Спецрежими</h3>
        ${THEMES.filter(([val]) => SPECIAL_THEMES.includes(val)).map(([val, label]) => radio('theme', val, label, s.theme)).join('')}
        <label class="night-level" id="night-level"${s.theme === 'night' ? '' : ' hidden'}><span>Яскравість червоного</span><input type="range" id="night-range" min="20" max="100" step="5" value="${nightLevel()}"></label>
        <p class="muted">Нічна — усе червоним, щоб не збивати нічний зір. Фосфор, Бурштин і Білий фосфор — як старі монітори-кінескопи.</p>`),
    backdropRow()])}
    ${setGroup('Синхронізація', [
    setRow('server', 'server', 'Сервер бота', '', `
        <p class="muted">Через сервер бота Хобі-плану — той самий, що в Хобі-плані, Вазі й Марнотраті. Прогрес однаковий на всіх пристроях, а підсумки приходять у вечірньому повідомленні Telegram-бота.</p>
        <div id="server-status" class="drive-status" role="status"></div>
        <div id="server-body" class="stack"></div>`),
    setRow('drive', 'cloud', `Google Диск${Bot.active() ? ' · копія' : ''}`, '', `
        <p class="muted">${Bot.active() ? 'Синхронізацію веде сервер, а Диск раз на день зберігає копію в файл bukvoid.json. Застосунок бачить лише свої файли.' : "Прогрес однаковий на комп'ютері й телефоні: копія лежить у файлі bukvoid.json на вашому Диску. Застосунок бачить лише свої файли. Увійшли в Google у Вазі чи Марнотраті — тут вхід уже є."}</p>
        <div id="drive-status" class="drive-status" role="status"></div>
        <div class="row" id="drive-actions"></div>`)])}
    ${setGroup('Дані', [
    setRow('backup', 'save', 'Резервна копія', '', `
        <p class="muted">Без Google Диска дані зберігаються лише в цьому браузері. Копія — файл, який можна перенести на інший пристрій.</p>
        <div class="row">
          <button type="button" class="btn" id="export">Зберегти копію</button>
          <label class="btn">Відновити з файлу<input type="file" id="import" accept="application/json,.json" hidden></label>
        </div>`),
    // Стерти — останнім рядком і згорнуте: небезпечна дія не має бути найпомітнішою на екрані
    setRow('reset', 'trash', 'Стерти весь прогрес', '', `
        <p class="muted">Уроки, тести, фрази й статистика клавіш — на цьому пристрої${Sync.enabled() || Bot.active() ? ' й під час синхронізації на інших' : ''}.</p>
        <div class="row"><button type="button" class="btn danger" id="reset">Стерти весь прогрес</button><span id="reset-confirm" hidden><button type="button" class="btn danger" id="reset-yes">Так, стерти</button> <button type="button" class="btn" id="reset-no">Ні</button></span></div>`,
    { danger: true })])}
    <p id="settings-msg" class="muted" role="status"></p>
    ${aboutHtml()}`;
  mountRows();
  mountServer();
  mountDrive();
  mountCourses();
  mountBackdrop();
  view().querySelector('.about-avatar').onclick = avatarHi;
  if (section === 'courses') $('row-courses').scrollIntoView();
  // Кожен перемикач зберігає всі чотири, як раніше спільна форма, і одразу міняє значення в рядку
  const prefs = view().querySelectorAll('input[name="mode"], input[name="keyboard"], input[name="fontSize"], input[name="theme"]');
  const pick = (name) => view().querySelector(`input[name="${name}"]:checked`)?.value;
  prefs.forEach((input) => {
    input.onchange = () => {
      const was = document.documentElement.dataset.theme;
      S.update((x) => {
        x.settings.mode = pick('mode');
        x.settings.theme = pick('theme');
        x.settings.keyboard = pick('keyboard') === 'on';
        x.settings.fontSize = pick('fontSize') || 'm';
      });
      applyTheme();
      $('night-level').hidden = set().theme !== 'night';
      // Набір фонів свій у темної й світлої теми, у спецрежимах рядка «Фон» немає — малюємо його заново
      if (document.documentElement.dataset.theme !== was) {
        $('row-backdrop')?.remove();
        $('row-theme').insertAdjacentHTML('afterend', backdropRow());
        mountRows();
        mountBackdrop();
      }
      view().querySelectorAll('.size-opt').forEach((l) => l.classList.toggle('on', l.querySelector('input').checked));
      Object.entries(prefLabels(set())).forEach(([k, text]) => setVal(k, text));
    };
  });
  // Ніч буває різна: тягнеш — сторінка одразу темнішає чи світлішає
  $('night-range').oninput = (e) => {
    try { localStorage.setItem('bukvoid:night-level', e.target.value); } catch { /* приватний режим */ }
    applyTheme();
  };
  const msg = (t) => { $('settings-msg').textContent = t; };
  $('export').onclick = () => {
    const blob = new Blob([S.exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `bukvoid-${S.today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    msg('Копію збережено в завантаження.');
  };
  $('import').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      S.importJson(await file.text());
      applyTheme();
      msg(Sync.enabled() ? 'Прогрес відновлено з копії. На інших пристроях він теж заміниться цією копією.' : 'Прогрес відновлено з копії.');
    } catch {
      msg('Не вдалося відновити: це не файл копії Буквоїда. Оберіть файл bukvoid-дата.json, збережений кнопкою «Зберегти копію».');
    }
  };
  $('reset').onclick = () => { $('reset-confirm').hidden = false; };
  $('reset-no').onclick = () => { $('reset-confirm').hidden = true; };
  $('reset-yes').onclick = () => { S.reset(); applyTheme(); renderSettings(); $('settings-msg').textContent = Sync.enabled() ? 'Прогрес стерто. На Google Диску й інших пристроях він зітреться під час синхронізації.' : 'Прогрес стерто.'; };
}

/** «Курси»: встановлені (показувати / видалити), каталог з репо, курс із файлу. */
function mountCourses() {
  const msg = (html) => { if ($('courses-msg')) $('courses-msg').innerHTML = html; };
  const drawInstalled = () => {
    if (!$('courses-installed')) return;
    const list = Courses.list();
    setVal('courses', `${typingOn().length + Courses.enabled().length} з ${TYPING_COURSES.length + list.length}`);
    // Три стани: на вкладці → сховані (на пристрої, прогрес цілий) → видалені (знову в «Каталозі» на вкладці «Курси»)
    const all = [
      ...TYPING_COURSES.map(({ id, lang }) => ({ id, builtin: true, on: Courses.builtinOn(id), icon: 'keyboard', title: typingTitle(lang), meta: `${lessons(lang).length} уроків · вбудований` })),
      ...list.map(({ id, pack, enabled, from }) => ({ id, on: enabled, icon: pack.icon, title: pack.title, meta: `${pack.units.length} тем · ${from === 'file' ? 'з файлу' : 'з каталогу'}` })),
    ];
    const row = (c) => `
      <div class="course-row" data-course-row="${esc(c.id)}">
        <span class="opt"><span class="course-ico small">${iconSvg(c.icon)}</span>
          <span><b>${esc(c.title)}</b><br><span class="muted small">${esc(c.meta)}</span></span></span>
        <span class="row-btns">${c.on
    ? `<button type="button" class="btn" data-course-hide="${esc(c.id)}">Сховати</button>`
    : `<button type="button" class="btn primary" data-course-show="${esc(c.id)}">Показати</button>${c.builtin ? '' : `<button type="button" class="btn danger" data-course-del="${esc(c.id)}">Видалити</button>`}`}</span>
      </div>`;
    const on = all.filter((c) => c.on);
    const off = all.filter((c) => !c.on);
    $('courses-installed').innerHTML = `
      <h3 class="sub-title">На вкладці «Курси»</h3>
      <p class="muted small">Курси, які ви проходите: їхні помилки й фрази — у повторенні.</p>
      ${on.length ? `<div class="course-list">${on.map(row).join('')}</div>` : '<p class="muted">Жодного — покажіть схований курс або додайте з каталогу.</p>'}
      ${off.length ? `<h3 class="sub-title">Сховані</h3>
      <p class="muted small">Лежать на пристрої, прогрес збережено. «Видалити» прибере курс із пристрою, прогрес лишиться й тоді.</p>
      <div class="course-list">${off.map(row).join('')}</div>` : ''}`;
    const toggle = (id, show) => (TYPING_COURSES.some((t) => t.id === id) ? Courses.setBuiltin(id, show) : Courses.setEnabled(id, show));
    $('courses-installed').querySelectorAll('[data-course-hide]').forEach((b) => {
      b.onclick = () => { toggle(b.dataset.courseHide, false); msg('Курс сховано — він у «Схованих», прогрес цілий.'); };
    });
    $('courses-installed').querySelectorAll('[data-course-show]').forEach((b) => {
      b.onclick = () => { toggle(b.dataset.courseShow, true); msg('Курс знову на вкладці «Курси».'); };
    });
    $('courses-installed').querySelectorAll('[data-course-del]').forEach((b) => {
      b.onclick = async () => {
        // Перше натискання питає: прогрес лишається, але курс зникне з вкладки
        if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Так, видалити'; return; }
        await Courses.remove(b.dataset.courseDel);
        msg('Курс видалено. Прогрес за ним лишився — повернеться, якщо додати курс знову.');
      };
    });
  };
  $('course-file').onchange = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const pack = await Courses.importFile(file);
      msg(`Курс «${esc(pack.title)}» додано — він на вкладці «Курси».`);
    } catch (err) {
      const list = err.errors?.length ? `<ul class="errors">${err.errors.slice(0, 8).map((x) => `<li>${esc(x)}</li>`).join('')}${err.errors.length > 8 ? `<li>…і ще ${err.errors.length - 8}</li>` : ''}</ul>` : '';
      msg(`<b>${esc(err.message)}</b>${list}`);
    }
  };
  const redraw = () => { drawInstalled(); };
  redraw();
  window.addEventListener('courses-change', redraw);
  window.addEventListener('hashchange', () => window.removeEventListener('courses-change', redraw), { once: true });
}

let unmountServer = null;

/** «Синхронізація»: адреса сервера й ключ доступу (одні на всі застосунки пристрою), стан обміну, підсумки в Telegram. */
function mountServer() {
  const when = (ts) => new Date(ts).toLocaleString('uk', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const TEXT = {
    off: () => 'Не ввімкнено',
    idle: (st) => `Увімкнено${st.last ? `<br><span class="muted">Обмін ${when(st.last)}</span>` : ''}`,
    syncing: () => 'Обмін…',
    offline: () => 'Немає мережі. Зміни поїдуть, щойно з\'явиться зв\'язок.',
    key: () => 'Ключ доступу не підходить — візьміть новий командою /key у Telegram-боті й вставте нижче.',
    old: () => 'Сервер бота ще не оновлено для Буквоїда. Прогрес збережено тут — обмін почнеться сам після оновлення.',
    error: (st) => `Не вдалося обмінятися: ${esc(st.message)}. Спробуйте ще раз.`,
  };
  let formOpen = false;
  const draw = (st) => {
    if (!$('server-status')) return;
    const cfg = Bot.config();
    const state = cfg ? st.state : Bot.keyProblem() ? 'key' : 'off';
    $('server-status').innerHTML = (TEXT[state] ?? TEXT.off)(st);
    $('server-status').dataset.state = state === 'key' || state === 'old' ? 'auth' : state;
    const VAL = { off: 'Вимкнено', syncing: 'Обмін…', offline: 'Офлайн', key: 'Ключ не підходить', old: 'Сервер не оновлено', error: 'Помилка' };
    setVal('server', state === 'idle' ? (st.last ? shortWhen(st.last) : 'Увімкнено') : VAL[state] ?? VAL.off,
      ['key', 'old', 'error'].includes(state) ? 'bad' : cfg ? 'ok' : '');
    if ($('server-body').contains(document.activeElement)) return;
    const form = `
      <label class="field">Адреса сервера<input type="url" id="srv-url" placeholder="https://….workers.dev" value="${esc(cfg?.url ?? '')}" autocomplete="off"></label>
      <label class="field">Ключ доступу<input type="password" id="srv-key" placeholder="команда /key у Telegram-боті" value="${esc(cfg?.key ?? '')}" autocomplete="off"></label>
      <div class="row"><button type="button" class="btn primary" id="srv-save">Зберегти</button>${cfg ? '<button type="button" class="btn" id="srv-off">Вимкнути синхронізацію</button>' : ''}</div>
      <p class="muted small">Ключ дає команда /key у Telegram-боті. Вставили в Хобі-плані, Вазі чи Марнотраті на цьому пристрої — тут він уже є.</p>`;
    $('server-body').innerHTML = cfg
      ? `<div class="row"><button type="button" class="btn" id="srv-run"${st.state === 'syncing' ? ' disabled' : ''}>Обмінятися зараз</button></div>
        <label class="opt"><input type="checkbox" id="srv-study"${Bot.studyOn() ? ' checked' : ''}> Підсумки дня й тижня в Telegram</label>
        <details class="about-more" id="srv-more"${formOpen ? ' open' : ''}><summary>Адреса й ключ</summary><div class="stack">${form}</div></details>`
      : form;
    const more = $('srv-more');
    if (more) more.ontoggle = () => { formOpen = more.open; };
    $('srv-save').onclick = () => {
      const url = $('srv-url').value.trim();
      const key = $('srv-key').value.trim();
      if (!url.startsWith('https://') || !key) { $('server-status').textContent = 'Вкажіть адресу https://… і ключ доступу.'; return; }
      formOpen = false;
      Bot.setConfig(url, key);
      renderSettings();
    };
    const off = $('srv-off');
    if (off) off.onclick = () => { Bot.disconnect(); renderSettings(); };
    const runBtn = $('srv-run');
    if (runBtn) runBtn.onclick = () => Bot.run();
    const study = $('srv-study');
    if (study) study.onchange = () => Bot.setStudyOn(study.checked);
  };
  unmountServer?.();
  unmountServer = Bot.onStatus(draw);
  window.addEventListener('hashchange', () => { unmountServer?.(); unmountServer = null; }, { once: true });
}

let unmountDrive = null;

/** Стан Google Диска в налаштуваннях: підписка живе, поки відкрито цей екран. */
function mountDrive() {
  const when = (ts) => (ts ? new Date(ts).toLocaleString('uk', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '');
  const TEXT = {
    off: () => 'Не підключено',
    idle: (st) => `Підключено${st.email ? ` · ${esc(st.email)}` : ''}${st.lastSync ? `<br><span class="muted">Синхронізовано ${when(st.lastSync)}</span>` : ''}`,
    syncing: () => 'Синхронізація…',
    offline: () => 'Немає мережі. Зміни поїдуть, щойно з\'явиться зв\'язок.',
    auth: () => 'Сесія Google закінчилась. Натисніть «Увійти», щоб продовжити.',
    error: (st) => `Не вдалося синхронізувати: ${esc(st.message)}. Спробуйте ще раз.`,
  };
  const draw = (st) => {
    if (!$('drive-status')) return;
    $('drive-status').innerHTML = TEXT[st.state]?.(st) ?? '';
    $('drive-status').dataset.state = st.state;
    const on = Sync.enabled();
    const VAL = { syncing: 'Синхронізація…', offline: 'Офлайн', auth: 'Увійти', error: 'Помилка' };
    setVal('drive', !on ? 'Не підключено' : st.state === 'idle' ? (st.lastSync ? shortWhen(st.lastSync) : 'Підключено') : VAL[st.state] ?? '',
      on && ['auth', 'error'].includes(st.state) ? 'bad' : on ? 'ok' : '');
    $('drive-actions').innerHTML = !on
      ? '<button type="button" class="btn primary" id="drive-connect">Підключити Google Диск</button>'
      : `${st.state === 'auth' ? '<button type="button" class="btn primary" id="drive-connect">Увійти</button>' : `<button type="button" class="btn" id="drive-sync"${st.state === 'syncing' ? ' disabled' : ''}>Синхронізувати зараз</button>`}
         <button type="button" class="btn" id="drive-off">Відключити</button>`;
    const connect = $('drive-connect');
    if (connect) connect.onclick = () => Sync.connect().catch((err) => { $('drive-status').textContent = err.message; });
    const now = $('drive-sync');
    if (now) now.onclick = () => Sync.syncNow();
    const off = $('drive-off');
    if (off) off.onclick = () => { Sync.disconnect(); };
  };
  unmountDrive?.();
  unmountDrive = Sync.onStatus(draw);
  window.addEventListener('hashchange', () => { unmountDrive?.(); unmountDrive = null; }, { once: true });
  Sync.preload();
}

// Аватар кліпає, як у Журналі стрільця — фото те саме, тож і контури очей ті самі (координати фото 233×233).
// Повіки — шар SVG поверх фото, обрізаний контуром білка; верхня з опуклою кромкою опускається, нижня підіймається
// назустріч. Праве око перше: ліве його перекриває.
const AVATAR_EYES = [
  { d: 'M114 63L114 65L117 71L117 78L121 78L122 77L126 77L127 76L132 76L135 79L137 79L139 77L140 72L141 71L141 68L140 67L140 64L135 59L131 57L122 57L118 59Z', box: [114, 57, 142, 80] },
  { d: 'M99 60L98 61L94 61L87 67L85 71L85 79L87 83L90 86L94 88L102 89L110 86L115 79L115 69L109 62Z', box: [85, 60, 116, 90] },
];
const AVATAR_SVG = '<svg viewBox="0 0 233 233" aria-hidden="true"><defs>'
  + AVATAR_EYES.map(({ d }, i) => `<clipPath id="av-eye${i}"><path d="${d}"/></clipPath>`).join('')
  + '</defs>'
  + AVATAR_EYES.map(({ box: [x0, y0, x1, y1] }, i) => {
    const hh = y1 - y0, e = y0 + hh * 0.6, k = hh * 0.26, cx = (x0 + x1) / 2, l = x0 - 3, r = x1 + 3;
    const edge = `M${l} ${e}Q${cx} ${e + k} ${r} ${e}`;
    return `<g clip-path="url(#av-eye${i})" fill="#fcd901">`
      + `<path class="av-lid low" style="--o:${(y1 - e + 3).toFixed(1)}px" d="${edge}V${y1 + 3}H${l}Z"/>`
      + `<g class="av-lid" style="--o:-${(e + k - y0 + 3).toFixed(1)}px"><path d="M${l} ${y0 - 3}H${r}V${e}Q${cx} ${e + k} ${l} ${e}Z"/>`
      + `<path d="${edge}" fill="none" stroke="#1d1d1d" stroke-width="2.6" stroke-linecap="round"/></g></g>`;
  }).join('')
  + '</svg>';

/** Тап по аватару — кліпнути одразу, не чекаючи свого часу. */
function avatarHi(e) {
  const el = e.currentTarget;
  el.classList.remove('hi');
  void el.offsetWidth;
  el.classList.add('hi');
  clearTimeout(el.hiTimer);
  el.hiTimer = setTimeout(() => el.classList.remove('hi'), 600);
}

/** «Про застосунок», як у Вазі й Журналі стрільця: автор, що це, де дані, з чого почати. */
// «На каву автору», як у Shooter’s Log: банка Монобанку звичайним посиланням, без сторонніх скриптів
const CUP_SVG = '<svg viewBox="0 0 16 20" aria-hidden="true">'
  + '<path class="st" d="M6 8.5c-2-2 2-3 0-6"/><path class="st" d="M10 8.5c-2-2 2-3 0-6"/>'
  + '<path d="M3 10h9v6a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z" fill="#f4f1ea" stroke="#3a2a1c"/>'
  + '<path d="M12 11.5h1.2a2 2 0 0 1 0 4H12" fill="none" stroke="#3a2a1c"/><ellipse cx="7.5" cy="10.4" rx="4" ry=".9" fill="#6b3f1f"/></svg>';

function aboutHtml() {
  return `
    <section class="card stack about">
      <h2>Про застосунок</h2>
      <div class="about-head">
        <span class="about-avatar"><img src="./icons/author.jpg" alt="" width="64" height="64" loading="lazy"><span class="av-live">${AVATAR_SVG}</span></span>
        <p class="muted">Буквоїд ${esc(self.APP_VERSION || '')}: курси з теорією, тестами, повторенням помилок і практичними завданнями, а також друк наосліп. Працює без інтернету, усе рахується на пристрої.</p>
      </div>
      <a class="donate-card" href="https://send.monobank.ua/jar/XJKDMyVfW" target="_blank" rel="noopener">
        <span class="donate-art">
          <span class="donate-cat"><img src="./icons/cat-portrait.png" alt="" width="50" height="50"><span class="donate-cup">${CUP_SVG}</span></span>
          <span class="donate-plate" aria-hidden="true">mono</span>
        </span>
        <span class="donate-text"><b>На каву автору</b><small>Безкоштовно й без реклами — тримається на вашій підтримці</small></span>
        <span class="donate-go" aria-hidden="true">→</span>
      </a>
      <details class="about-more"><summary>Де мої дані</summary>
        <div class="muted">
          <p>Прогрес лежить у браузері на цьому пристрої. Сервера в застосунку немає, автор не отримує ні даних, ні статистики.</p>
          <p>Синхронізація через сервер бота Хобі-плану — за бажанням, вашим ключем доступу. Боту для підсумків ідуть лише хвилини, швидкість, точність і назви пройдених уроків — без набраних текстів.</p>
          <p>Google Диск підключається за бажанням: копія лягає у файл bukvoid.json на вашому Диску, застосунок бачить лише свої файли.</p>
          <p>Резервна копія у файл — кнопка «Зберегти копію» вище. Нею ж можна перенести прогрес на інший пристрій.</p>
        </div>
      </details>
      <details class="about-more"><summary>З чого почати</summary>
        <ol class="about-steps">
          <li>Оберіть курс на вкладці «Курси» або додайте з «Каталогу». Тема — теорія, приклади, тест; «Завдання» — те, що варто зробити руками.</li>
          <li>Тест зараховано від прохідного балу курсу (зазвичай 80%). Помилки повертаються в «Повторення» наступного дня — заходьте туди щодня, хоч на 5 хвилин.</li>
          <li>Друк наосліп — на комп'ютері: «Перш ніж почати» на сторінці курсу, далі уроки по черзі, 15–20 хвилин щодня; урок зараховано від 97% точності.</li>
          <li>Підключіть Google Диск, щоб прогрес був однаковий на комп'ютері й телефоні.</li>
        </ol>
      </details>
      <p class="muted small">
        <a href="https://github.com/VitaliyLobko/bukvoid" target="_blank" rel="noopener">Вихідний код</a>.
        Правопис — за редакцією 2019 року (<a href="https://2019.pravopys.net/" target="_blank" rel="noopener">2019.pravopys.net</a>).
        Шрифти Unbounded і JetBrains Mono — <a href="https://openfontlicense.org/" target="_blank" rel="noopener">SIL Open Font License</a>.
      </p>
    </section>`;
}

// ---------- Підсумки для бота Хобі-плану ----------

const LANG_SHORT = { uk: 'укр.', en: 'англ.', ru: 'рос.' };
const STUDY_DAYS = 35;

function lessonTitle(id) {
  const [lang, n] = id.split(':');
  return `Урок ${n} (${LANG_SHORT[lang] ?? lang})`;
}

function testTitle(id) {
  const [kind, key] = [id.slice(0, 2), id.slice(3)];
  if (kind === 'sp') return Courses.unit(S.SPELLING_COURSE, key)?.title ?? key;
  if (kind === 'c:') {
    const [cid, uid] = key.split('/');
    return Courses.unit(cid, uid)?.title ?? uid;
  }
  // en:a2-01 — тест англійської до курсів
  return `English: ${Courses.unit(`en-${key.slice(0, 2)}`, key)?.title ?? key}`;
}

/** Курс пройденого уроку друку («uk:3») чи тесту («c:курс/тема», «sp:…», «en:a2-01») — для зарахування за курсом. */
function passCourse(id) {
  if (/^(uk|en|ru):\d+$/.test(id)) return `druk-${id.slice(0, 2)}`;
  if (id.startsWith('c:')) return id.slice(2).split('/')[0];
  if (id.startsWith('sp:')) return S.SPELLING_COURSE;
  if (id.startsWith('en:')) return `en-${id.slice(3, 5)}`;
  return '';
}

/** День для бота: хвилини друку й тестів, швидкість і точність, назви пройденого; cms і cpass — те саме по курсах. */
function studyDay(date) {
  const d = S.day(date);
  const cpass = {};
  for (const id of [...d.passed, ...Object.keys(d.tests)]) {
    const cid = passCourse(id);
    if (cid) cpass[cid] = (cpass[cid] || 0) + 1;
  }
  return {
    date, ms: d.ms, qms: d.qms, chars: d.chars, errors: d.errors, srs: d.srs, cms: d.cms, cpass,
    cpm: d.ms ? Math.round(d.chars / (d.ms / 60000)) : 0,
    acc: d.chars ? Math.round(1000 * (1 - d.errors / d.chars)) / 10 : 0,
    passed: d.passed.map(lessonTitle),
    tests: Object.entries(d.tests).map(([id, [sc, n]]) => [testTitle(id), sc, n]),
  };
}

/** Увімкнені курси з наступною темою — Хобі-плану (вибір курсу заняття, «далі: …») і боту (посилання). */
function courseList() {
  const out = typingOn().map(({ id, lang }) => {
    const l = nextLesson(lang);
    return { id, title: typingTitle(lang), next: l ? { href: `lesson/${lang}/${l.n}`, n: l.n, title: l.title, done: typingDone(lang) === lessons(lang).length } : null };
  });
  for (const { id, pack } of Courses.enabled()) {
    const p = courseProgress(id);
    const i = pack.units.findIndex((u) => !unitDone(p[u.id], pack));
    const u = pack.units[i < 0 ? pack.units.length - 1 : i];
    out.push({ id, title: pack.title, next: u ? { href: `k/${id}/${u.id}`, n: (i < 0 ? pack.units.length - 1 : i) + 1, title: u.title, done: i < 0 } : null });
  }
  return out;
}

function studyPayload() {
  const t = new Date();
  t.setDate(t.getDate() - STUDY_DAYS);
  const from = S.dayKey(t);
  const dates = new Set();
  for (const dev of Object.values(st().dev)) for (const d of Object.keys(dev.days)) if (d >= from) dates.add(d);
  const lang = set().lang;
  const all = ['uk', 'en'].flatMap((l) => lessons(l));
  const packs = Courses.enabled();
  const c = SRS.counts(packs);
  return {
    from,
    days: [...dates].sort().map(studyDay),
    srs: { due: SRS.dueForecast(packs), mdue: SRS.mistakeForecast(packs), total: c.total, learned: c.learned },
    weak: weakKeys(S.keyStats(lang), 6).map((w) => w.ch),
    lessons: { done: all.filter((l) => st().typing[l.id]?.done).length, total: all.length },
    current: currentCourse(),
    courses: courseList().map(({ id, title, next }) => ({ id, title, next })),
  };
}

// Хобі-план на тому ж origin показує плашку «Буквоїд сьогодні» на «Сьогодні» (як вагу й гроші)
const STUDY_SHARE = 'vitaliylobko:study-today';

function shareToday() {
  const d = studyDay(S.today());
  const packs = Courses.enabled();
  const due = SRS.dueForecast(packs, 1)[S.today()] ?? 0;
  const mdue = SRS.mistakeForecast(packs, 1)[S.today()] ?? 0;
  const cmin = Object.fromEntries(Object.entries(d.cms).map(([cid, ms]) => [cid, Math.round(ms / 60000)]));
  try {
    localStorage.setItem(STUDY_SHARE, JSON.stringify({ date: d.date, min: Math.round((d.ms + d.qms) / 60000), cpm: d.cpm, acc: d.acc, passed: d.passed.length, due, mdue, cmin, current: currentCourse(), courses: courseList(), at: Date.now() }));
  } catch { /* приватний режим */ }
}

// ---------- Каркас ----------

// Розмір тексту — множник усіх шрифтів (--fs у css/app.css); кнопки й поля ростуть разом з текстом
const FONT_SCALE = { s: 0.9, m: 1, l: 1.12, xl: 1.25 };

function applyTheme() {
  const pref = set().theme;
  const light = pref === 'light' || (pref === 'auto' && matchMedia('(prefers-color-scheme: light)').matches);
  document.documentElement.dataset.theme = SPECIAL_THEMES.includes(pref) ? pref : light ? 'light' : 'dark';
  const bg = backdropPref(document.documentElement.dataset.theme);
  if (bg) document.documentElement.dataset.bg = bg; else delete document.documentElement.dataset.bg;
  try { localStorage.setItem('bukvoid:theme', pref); } catch { /* приватний режим */ }
  const k = nightLevel() / 100;
  document.querySelector('#night-red feColorMatrix')?.setAttribute('values',
    `${(0.5 * k).toFixed(3)} ${(0.6 * k).toFixed(3)} ${(0.1 * k).toFixed(3)} 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0`);
  const fs = String(FONT_SCALE[set().fontSize] ?? 1);
  document.documentElement.style.setProperty('--fs', fs);
  try { localStorage.setItem('bukvoid:fs', fs); } catch { /* приватний режим */ }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
}

/** Яскравість червоного в нічній темі, 20–100 %; лише на цьому пристрої. */
function nightLevel() {
  let v = 0;
  try { v = Number(localStorage.getItem('bukvoid:night-level')); } catch { /* приватний режим */ }
  return v >= 20 && v <= 100 ? v : 80;
}

function go(hash) {
  location.hash = hash;
}

// Поточний курс — останній відкритий на цьому пристрої; кнопка посередині нижньої панелі веде в нього
const CURRENT_KEY = 'bukvoid:current-course';
function routeCourse(name, args) {
  if (name === 'kurs' || name === 'k') return args[0];
  if (name === 'lesson') return `druk-${args[0]}`;
  if (name === 'free') return `druk-${args[1] || set().lang}`;
  if (name === 'pravopys' || name === 'topic') return S.SPELLING_COURSE;
  if (name === 'unit') return `en-${(args[0] || '').slice(0, 2)}`;
  return null;
}
const courseExists = (id) => TYPING_COURSES.some((c) => c.id === id) || !!Courses.get(id);
/** Останній відкритий курс на цьому пристрої; null — ще жодного не відкривали. */
function lastCourse() {
  let id = null;
  try { id = localStorage.getItem(CURRENT_KEY); } catch { /* приватний режим */ }
  return id && courseExists(id) ? id : null;
}
function currentCourse() {
  return lastCourse() ?? `druk-${set().lang}`;
}
/** Назва для нижньої панелі: поле short курсу, інакше частина до « · » чи «:» («English A2 · Elementary» → «English A2»). */
function shortTitle(pack) {
  if (pack.short) return pack.short;
  const cut = pack.title.split(/ · |: /)[0];
  return cut.length >= 4 ? cut : pack.title;
}
function drawCurrentTab() {
  const id = currentCourse();
  const typing = TYPING_COURSES.find((c) => c.id === id);
  const pack = typing ? null : Courses.get(id);
  const title = typing ? typingTitle(typing.lang) : pack.title;
  const a = $('tab-current');
  a.href = `#kurs/${id}`;
  a.title = title;
  a.setAttribute('aria-label', `Поточний курс: ${title}`);
  // У панелі коротко: «Друк · Українська» — повна назва на вузькому екрані обрізалась би
  a.innerHTML = `${iconSvg(typing ? 'keyboard' : pack.icon)}<span>${esc(typing ? `Друк · ${LANG_NAMES[typing.lang]}` : shortTitle(pack))}</span>`;
}

function route() {
  const [name, ...args] = (location.hash.slice(1) || 'kursy').split('/');
  const cid = routeCourse(name, args);
  if (cid && courseExists(cid)) { try { localStorage.setItem(CURRENT_KEY, cid); } catch { /* приватний режим */ } }
  drawCurrentTab();
  const views = {
    druk: renderDruk, lesson: renderLesson, free: renderFree,
    kursy: renderCourses, kurs: renderCourse, k: renderCourseUnit,
    pravopys: () => renderCourse(S.SPELLING_COURSE), topic: (id) => renderCourseUnit(S.SPELLING_COURSE, id),
    english: renderCourses, unit: (id = '') => renderCourseUnit(`en-${id.slice(0, 2)}`, id),
    srs: renderSrs, mistakes: renderMistakes, progress: renderProgress, settings: renderSettings,
  };
  const fn = views[name] || renderCourses;
  const tab = cid && cid === currentCourse() ? 'current' : TABS[name] || 'kursy';
  document.querySelectorAll('.tabs a').forEach((a) => {
    const on = a.dataset.tab === tab;
    a.classList.toggle('on', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  $('settings-btn').classList.toggle('on', name === 'settings');
  fn(...args);
  window.scrollTo(0, 0);
}

function registerWorker() {
  if (!('serviceWorker' in navigator)) return;
  // Локально без ?sw працюємо без кешу, щоб правки було видно одразу
  if (/^(127\.0\.0\.1|localhost)$/.test(location.hostname) && !location.search.includes('sw')) return;
  const offer = (worker) => {
    $('update').hidden = false;
    $('update-btn').onclick = () => worker.postMessage('skipWaiting');
  };
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then((reg) => {
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) offer(worker);
      });
    });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch((err) => console.warn('SW registration failed', err));
  // Перше встановлення теж міняє controller — тоді перезавантаження перервало б урок
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !hadController) return;
    reloading = true;
    location.reload();
  });
}

// «До змісту» лише переводить фокус: зміна hash тут означала б перехід на іншу сторінку
document.querySelector('.skip').addEventListener('click', (e) => { e.preventDefault(); $('view').focus(); });

applyTheme();
// Висота шапки — для змісту теми, що прилипає під нею (шапка росте з розміром тексту й safe-area)
{
  const bar = document.querySelector('.topbar');
  const setH = () => document.documentElement.style.setProperty('--topbar-h', `${Math.round(bar.getBoundingClientRect().height)}px`);
  if (bar) { setH(); new ResizeObserver(setH).observe(bar); }
}
matchMedia('(prefers-color-scheme: light)').addEventListener('change', applyTheme);
window.addEventListener('hashchange', route);
registerWorker();
await Courses.ready();
route();
// Нові версії курсів каталогу й курси, по яких прийшов прогрес з іншого пристрою
const progressIds = () => [...Object.keys(st().courses), ...SRS.courseIdsWithCards()];
Courses.refresh(progressIds());
window.addEventListener('sync-applied', () => Courses.refresh(progressIds()));
window.addEventListener('courses-change', () => {
  const name = location.hash.slice(1).split('/')[0];
  if (['', 'kursy', 'kurs', 'pravopys', 'english', 'progress'].includes(name)) route();
  else drawCurrentTab();
});
Sync.start();
Bot.start(studyPayload);
shareToday();
window.addEventListener('bukvoid-change', shareToday);
window.addEventListener('sync-applied', shareToday);
// Прострочений ключ Google оновлюємо з дотику, який людина й так робить
// (кнопка входу на Диск сама просить ключ — друге вікно Google тут зайве)
document.addEventListener('click', (e) => { if (e.target.closest('.btn.primary') && !e.target.closest('#drive-connect')) Sync.renewOnGesture(); }, true);
// Прийшов прогрес з іншого пристрою: перемалювати лише списки — урок чи тест посеред вправи не чіпаємо
window.addEventListener('sync-applied', () => {
  const name = location.hash.slice(1).split('/')[0] || 'kursy';
  if (!['kursy', 'kurs', 'pravopys', 'english', 'progress'].includes(name)) return;
  const y = window.scrollY;
  route();
  window.scrollTo(0, y);
});
// Справжня розкладка (Chromium на комп'ютері) — з першого натискання, коли сторінка вже в фокусі
document.addEventListener('keydown', () => { detectLayout(); }, { once: true });
detectLayout();
