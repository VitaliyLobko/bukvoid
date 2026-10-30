import * as S from './store.js';
import { esc, inline, blocksHtml } from './blocks.js';
import { mountTyping, keyboardHtml, handsHtml } from './typing.js';
import { mountQuiz } from './quiz.js';
import { lessons, exercisesFor, weakKeys, weakText, wordsText, textsText, THEORY, PASS_ACC } from './course.js';
import { detectLayout, LANG_NAMES } from './layouts.js';
import * as SRS from './srs.js';
import SPELLING from './data/uk-spelling.js';
import A2 from './data/en-a2.js';
import B1 from './data/en-b1.js';

const LEVELS = [A2, B1];
const $ = (id) => document.getElementById(id);
const view = () => $('view');
const st = () => S.get();
const set = () => st().settings;

const TABS = { druk: 'druk', lesson: 'druk', free: 'druk', pravopys: 'pravopys', topic: 'pravopys', english: 'english', unit: 'english', srs: 'english', progress: 'progress', settings: 'settings' };

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

function renderDruk() {
  const lang = set().lang;
  const list = lessons(lang);
  const next = list.find((l) => !lessonState(l.id).done) || list[list.length - 1];
  const day = st().days[S.today()];
  const weak = weakKeys(st().keys[lang]);
  view().innerHTML = `
    <h1 class="sr-only">Друк наосліп</h1>
    <section class="hero">
      <div class="hero-main">
        <div class="hero-num">${day ? day.chars : 0}<small>букв з'їдено сьогодні</small></div>
        <div class="muted">${day ? `${Math.round(day.ms / 60000)} хв · точність ${day.chars ? Math.round((day.chars / (day.chars + day.errors)) * 1000) / 10 : 100}%` : 'Почніть з уроку нижче — 15 хвилин на день досить.'}</div>
      </div>
      <a class="btn primary big" href="#lesson/${lang}/${next.n}">${lessonState(next.id).parts.a ? 'Продовжити' : 'Почати'}: урок ${next.n}</a>
    </section>

    <div class="seg" role="tablist" aria-label="Мова друку">
      ${['uk', 'en', 'ru'].map((l) => `<button type="button" role="tab" class="${l === lang ? 'on' : ''}" data-lang="${l}">${LANG_NAMES[l]}</button>`).join('')}
    </div>

    <h2 class="section-title">Вільне тренування</h2>
    <div class="tiles">
      <a class="tile" href="#free/weak"><b>Слабкі клавіші</b><span class="muted">${weak.length ? weak.slice(0, 5).map((w) => esc(w.ch)).join(' ') : 'з\'являться після кількох вправ'}</span></a>
      <a class="tile" href="#free/words"><b>Слова</b><span class="muted">усі літери</span></a>
      <a class="tile" href="#free/texts"><b>Текст</b><span class="muted">речення й прислів'я</span></a>
      <a class="tile" href="#free/own"><b>Свій текст</b><span class="muted">вставте будь-що</span></a>
    </div>

    <h2 class="section-title">Перш ніж почати</h2>
    <div class="theory-list">
      ${THEORY.map((t) => `<details class="fold"${t.id === 'home' && !lessonState(list[0].id).done ? ' open' : ''}><summary>${esc(t.title)}</summary><div class="prose">${blocksHtml(t.blocks)}${t.id === 'home' ? handsHtml(lang) + keyboardHtml(lang, { zones: true }) : ''}</div></details>`).join('')}
    </div>

    <h2 class="section-title">Уроки: ${LANG_NAMES[lang].toLowerCase()} розкладка</h2>
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
  view().querySelectorAll('[data-lang]').forEach((b) => {
    b.onclick = () => { S.update((s) => { s.settings.lang = b.dataset.lang; }); renderDruk(); };
  });
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
  if (!lesson) return go('druk');
  const exs = exercisesFor(lang, lesson);
  const s = lessonState(lesson.id);
  let current = exs.find((e) => (s.parts[e.key]?.acc ?? 0) < PASS_ACC)?.key || 'a';

  const draw = () => {
    const state = lessonState(lesson.id);
    view().innerHTML = `
      ${head(`Урок ${lesson.n}. ${lesson.title}`, '#druk', lesson.fresh.length ? `Нові клавіші: ${lesson.fresh.map((c) => `<kbd>${esc(c.toUpperCase())}</kbd>`).join(' ')}` : esc(lesson.note || ''))}
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
        S.recordSession({ lang, ...r });
        const passed = r.acc >= PASS_ACC;
        S.update((x) => {
          const t = (x.typing[lesson.id] ||= { parts: {}, done: false });
          const prev = t.parts[current];
          if (!prev || r.acc > prev.acc || (r.acc === prev.acc && r.cpm > prev.cpm)) t.parts[current] = { acc: r.acc, cpm: r.cpm };
          t.done = ['a', 'b', 'c'].every((k) => (t.parts[k]?.acc ?? 0) >= PASS_ACC);
        });
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

function renderFree(kind) {
  const lang = set().lang;
  const titles = { weak: 'Слабкі клавіші', words: 'Слова', texts: 'Текст', own: 'Свій текст' };
  if (!titles[kind]) return go('druk');
  const make = () => {
    if (kind === 'weak') return weakText(lang, weakKeys(st().keys[lang])) || wordsText(lang);
    if (kind === 'words') return wordsText(lang);
    if (kind === 'texts') return textsText(lang);
    return null;
  };
  let ownText = '';
  try { ownText = localStorage.getItem('bukvoid:own') || ''; } catch { /* приватний режим */ }

  const run = (text) => {
    view().innerHTML = `${head(titles[kind], '#druk', kind === 'weak' && !weakKeys(st().keys[lang]).length ? 'Статистики ще мало — поки що звичайні слова' : LANG_NAMES[lang])}<div id="typer"></div><div id="after"></div>`;
    mountTyping($('typer'), {
      text, lang, mode: set().mode, keyboard: set().keyboard,
      onDone: (r) => {
        S.recordSession({ lang, ...r });
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
    view().innerHTML = `${head(titles.own, '#druk', 'Вставте лист, код-рев\'ю чи статтю — тренуйтеся на тому, що реально друкуєте')}
      <form id="own-form" class="stack">
        <label class="field-label" for="own-text">Текст для тренування</label>
        <textarea id="own-text" rows="8">${esc(ownText)}</textarea>
        <div class="row"><button type="submit" class="btn primary">Друкувати</button><span class="muted">Розкладка: ${LANG_NAMES[lang].toLowerCase()}. Змінити — на головній сторінці «Друку».</span></div>
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

// ---------- Правопис ----------

function renderPravopys() {
  view().innerHTML = `
    ${head('Правопис', '', 'Мінімальний курс за Українським правописом 2019 року')}
    <ol class="lessons topics">
      ${SPELLING.map((t, i) => {
        const r = st().spelling[t.id];
        return `<li><a href="#topic/${t.id}" class="${r && r.best === r.total ? 'done' : ''}">
          <span class="num">${i + 1}</span>
          <span class="l-title">${esc(t.title)}<span class="muted small">${esc(t.source || '')}</span></span>
          <span class="l-state">${r ? `${r.best}/${r.total}` : ''}</span></a></li>`;
      }).join('')}
    </ol>`;
}

function examplesHtml(list) {
  return `<div class="examples">${list.map((x) => (typeof x === 'string' ? `<span class="ex">${esc(x)}</span>` : `<span class="ex" title="${esc(x.note || '')}">${esc(x.w)}${x.note ? `<small>${esc(x.note)}</small>` : ''}</span>`)).join('')}</div>`;
}

function renderTopic(id) {
  const i = SPELLING.findIndex((t) => t.id === id);
  const t = SPELLING[i];
  if (!t) return go('pravopys');
  view().innerHTML = `
    ${head(t.title, '#pravopys', esc(t.goal || ''))}
    <article class="prose card">${blocksHtml(t.theory)}</article>
    ${t.examples?.length ? `<h2 class="section-title">Приклади</h2>${examplesHtml(t.examples)}` : ''}
    <h2 class="section-title">Тест</h2>
    <div id="quiz" class="card"></div>
    <h2 class="section-title">Надрукуйте правильно</h2>
    <div id="typer" class="card"></div><div id="after"></div>
    ${SPELLING[i + 1] ? `<a class="btn next-topic" href="#topic/${SPELLING[i + 1].id}">Наступна тема: ${esc(SPELLING[i + 1].title)} ›</a>` : ''}`;
  mountQuiz($('quiz'), t.exercises, {
    onDone: (score, total) => S.update((s) => {
      const prev = s.spelling[t.id];
      s.spelling[t.id] = { best: Math.max(prev?.best ?? 0, score), total, at: S.today() };
    }),
  });
  typingBlock(t.typing, 'uk');
}

/** Друк речень теми: закріплює і правопис, і руку. */
function typingBlock(sentences, lang) {
  if (!sentences?.length) { $('typer').closest('.card').remove(); return; }
  const start = () => mountTyping($('typer'), {
    text: sentences.join(' '), lang, mode: set().mode, keyboard: false,
    onDone: (r) => {
      S.recordSession({ lang, ...r });
      $('after').innerHTML = resultHtml(r, r.acc >= PASS_ACC) + '<div class="row"><button type="button" class="btn" data-act="again">Ще раз</button></div>';
      $('after').querySelector('[data-act="again"]').onclick = () => { $('after').innerHTML = ''; start(); };
    },
  });
  // Не перехоплюємо фокус, поки людина читає теорію: друк стартує по кліку
  $('typer').innerHTML = `<button type="button" class="btn primary" id="start-typing">Почати друк · ${sentences.length} речень</button>`;
  $('start-typing').onclick = start;
}

// ---------- English ----------

function renderEnglish() {
  const level = LEVELS.find((l) => l.id === set().level) || LEVELS[0];
  const c = SRS.counts(LEVELS);
  view().innerHTML = `
    ${head('English', '', 'Два рівні: від основи до робочої англійської')}
    <a class="hero srs-card" href="#srs">
      <div class="hero-main"><div class="eyebrow">Повторення фраз</div>
      <div class="hero-num">${c.due}<small> на сьогодні</small></div>
      <div class="muted">${c.total ? `у колоді ${c.total}, вивчено ${c.learned}` : 'Відкрийте юніт — його фрази додадуться в колоду'}</div></div>
      <span class="btn primary big">${c.due ? 'Повторити' : 'Колода'}</span>
    </a>
    <div class="seg" role="tablist" aria-label="Рівень">
      ${LEVELS.map((l) => `<button type="button" role="tab" class="${l === level ? 'on' : ''}" data-level="${l.id}">${esc(l.title)}<small>${esc(l.subtitle || '')}</small></button>`).join('')}
    </div>
    <ol class="lessons units">
      ${level.units.map((u, i) => {
        const r = st().english[u.id];
        return `<li><a href="#unit/${u.id}" class="${r && r.best / r.total >= 0.8 ? 'done' : ''}">
          <span class="num">${i + 1}</span>
          <span class="l-title">${esc(u.title)}<span class="muted small">${esc(u.topic || '')}</span></span>
          <span class="l-state">${r ? `${r.best}/${r.total}` : ''}</span></a></li>`;
      }).join('')}
    </ol>`;
  view().querySelectorAll('[data-level]').forEach((b) => {
    b.onclick = () => { S.update((s) => { s.settings.level = b.dataset.level; }); renderEnglish(); };
  });
}

function findUnit(id) {
  for (const level of LEVELS) {
    const i = level.units.findIndex((u) => u.id === id);
    if (i >= 0) return { level, unit: level.units[i], next: level.units[i + 1] };
  }
  return {};
}

function renderUnit(id) {
  const { level, unit, next } = findUnit(id);
  if (!unit) return go('english');
  SRS.enroll(unit);
  view().innerHTML = `
    ${head(unit.title, '#english', `${esc(unit.topic || '')}, рівень ${esc(level.title)}`)}
    ${unit.goal ? `<p class="goal">${inline(unit.goal)}</p>` : ''}
    <nav class="toc">
      <a href="#u-theory">Правило</a><a href="#u-examples">Приклади</a><a href="#u-words">Фрази</a>${unit.media?.length ? '<a href="#u-media">Відео й аудіо</a>' : ''}<a href="#u-test">Тест</a><a href="#u-typing">Друк</a>
    </nav>
    <article class="prose card" id="u-theory">${blocksHtml(unit.theory)}</article>
    <h2 class="section-title" id="u-examples">Приклади</h2>
    <div class="card pairs">${unit.examples.map((x) => `<div class="pair"><button type="button" class="say" data-say="${esc(x.en)}" aria-label="Озвучити">${SPEAKER}</button><span class="en">${inline(x.en)}</span><span class="uk muted">${inline(x.uk)}</span></div>`).join('')}</div>
    <h2 class="section-title" id="u-words">Фрази юніту <span class="muted">уже в колоді повторення</span></h2>
    <div class="card pairs">${unit.words.map((w) => `<div class="pair"><button type="button" class="say" data-say="${esc(w.ex || w.en)}" aria-label="Озвучити">${SPEAKER}</button><span class="en"><b>${esc(w.en)}</b>${w.ex ? `<small>${esc(w.ex)}</small>` : ''}</span><span class="uk muted">${esc(w.uk)}</span></div>`).join('')}</div>
    ${unit.media?.length ? `<h2 class="section-title" id="u-media">Відео й аудіо</h2><div class="media">${unit.media.map((m) => `<a class="tile" href="${esc(m.url)}" target="_blank" rel="noopener"><b>${mediaLabel(m)} · ${esc(m.title)}</b>${m.note ? `<span class="muted">${esc(m.note)}</span>` : ''}</a>`).join('')}</div>` : ''}
    <h2 class="section-title" id="u-test">Тест</h2>
    <div id="quiz" class="card"></div>
    <h2 class="section-title" id="u-typing">Надрукуйте фрази</h2>
    <div id="typer" class="card"></div><div id="after"></div>
    ${next ? `<a class="btn next-topic" href="#unit/${next.id}">Наступний юніт: ${esc(next.title)} ›</a>` : ''}`;
  view().querySelectorAll('[data-say]').forEach((b) => { b.onclick = () => speak(b.dataset.say); });
  view().querySelectorAll('.toc a').forEach((a) => {
    a.onclick = (e) => { e.preventDefault(); document.querySelector(a.getAttribute('href'))?.scrollIntoView({ behavior: 'smooth' }); };
  });
  mountQuiz($('quiz'), unit.exercises, {
    onDone: (score, total) => S.update((s) => {
      const prev = s.english[unit.id];
      s.english[unit.id] = { best: Math.max(prev?.best ?? 0, score), total, at: S.today() };
    }),
  });
  typingBlock(unit.typing, 'en');
}

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
  const queue = SRS.dueCards(LEVELS).sort(() => Math.random() - 0.5);
  let done = 0;
  let ok = 0;
  const show = () => {
    const card = queue[0];
    if (!card) {
      const c = SRS.counts(LEVELS);
      view().innerHTML = `${head('Повторення фраз', '#english')}<div class="card quiz summary">
        <div class="big-score">${done ? `${ok}<small> / ${done}</small>` : '0'}</div>
        <p>${done ? 'На сьогодні все. Наступні фрази повернуться в потрібний день — так вони переходять у довгу пам\'ять.' : c.total ? 'Сьогодні повторювати нічого. Завтра колода покаже нові.' : 'Колода порожня: відкрийте будь-який юніт англійської — його фрази додадуться сюди.'}</p>
        <a class="btn primary" href="#english">До юнітів</a></div>`;
      return;
    }
    view().innerHTML = `${head('Повторення фраз', '#english', `лишилось ${queue.length} · коробка ${card.box + 1} з 7`)}
      <div class="card quiz">
        <div class="q-meta muted">${esc(card.unit.title)}</div>
        <div class="q-text">${esc(card.word.uk)}</div>
        ${card.word.ex ? `<p class="muted">${esc(maskPhrase(card.word.ex, card.word.en))}</p>` : ''}
        <form class="q-form" id="srs-form"><input class="q-input" id="srs-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="англійською" aria-label="Фраза англійською"><button type="submit" class="btn primary">Перевірити</button></form>
        <div class="q-feedback" id="srs-fb" hidden></div>
      </div>`;
    const input = $('srs-input');
    input.focus();
    $('srs-form').onsubmit = (e) => {
      e.preventDefault();
      const given = input.value.trim();
      if (!given) return;
      const right = normalizeLoose(given) === normalizeLoose(card.word.en);
      input.disabled = true;
      input.classList.add(right ? 'good' : 'bad');
      SRS.grade(card.id, right);
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
  const days = [];
  for (let i = 13; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = S.dayKey(d);
    days.push({ key, label: d.getDate(), ...(s.days[key] || { chars: 0, ms: 0, errors: 0 }) });
  }
  const max = Math.max(1, ...days.map((d) => d.chars));
  const langs = ['uk', 'en', 'ru'];
  const typingDone = (lang) => lessons(lang).filter((l) => lessonState(l.id).done).length;
  const spellDone = SPELLING.filter((t) => s.spelling[t.id]).length;
  const enDone = LEVELS.map((l) => `${l.title}: ${l.units.filter((u) => s.english[u.id]).length}/${l.units.length}`).join(' · ');
  const c = SRS.counts(LEVELS);
  view().innerHTML = `
    ${head('Прогрес', '')}
    <div class="stat-grid">
      <div class="stat"><b>${s.totals.chars.toLocaleString('uk')}</b><span>букв з'їдено</span></div>
      <div class="stat"><b>${Math.round(s.totals.ms / 60000)}</b><span>хвилин друку</span></div>
      <div class="stat"><b>${s.totals.bestCpm}</b><span>найкраща швидкість, зн/хв</span></div>
      <div class="stat"><b>${s.totals.sessions}</b><span>вправ</span></div>
    </div>
    <h2 class="section-title">Останні 14 днів</h2>
    <div class="card bars" role="img" aria-label="Знаків за день">
      ${days.map((d) => `<div class="bar" title="${d.key}: ${d.chars} знаків"><span style="height:${(d.chars / max) * 100}%"></span><small>${d.label}</small></div>`).join('')}
    </div>
    <h2 class="section-title">Курси</h2>
    <div class="card list">
      ${langs.map((l) => `<div class="li"><span>Друк · ${LANG_NAMES[l]}</span><b>${typingDone(l)}/${lessons(l).length}</b></div>`).join('')}
      <div class="li"><span>Правопис</span><b>${spellDone}/${SPELLING.length}</b></div>
      <div class="li"><span>English</span><b>${enDone}</b></div>
      <div class="li"><span>Фрази в колоді</span><b>${c.learned} вивчено з ${c.total}</b></div>
    </div>
    <h2 class="section-title">Слабкі клавіші</h2>
    ${langs.map((l) => {
      const w = weakKeys(s.keys[l], 8);
      if (!w.length) return '';
      return `<div class="card"><div class="muted">${LANG_NAMES[l]}</div><div class="table-wrap"><table class="weak"><thead><tr><th>Клавіша</th><th>Помилок</th><th>Сер. час</th></tr></thead><tbody>
        ${w.map((k) => `<tr><td><kbd>${esc(k.ch === ' ' ? '␣' : k.ch)}</kbd></td><td>${Math.round(k.rate * 100)}%</td><td>${Math.round(k.ms)} мс</td></tr>`).join('')}
      </tbody></table></div></div>`;
    }).join('') || '<p class="muted">З\'являться після кількох вправ.</p>'}`;
}

// ---------- Налаштування ----------

function renderSettings() {
  const s = set();
  const radio = (name, value, label, cur) => `<label class="opt"><input type="radio" name="${name}" value="${value}"${cur === value ? ' checked' : ''}> ${label}</label>`;
  view().innerHTML = `
    ${head('Налаштування', '')}
    <form class="card stack" id="settings-form">
      <fieldset><legend>Помилки під час друку</legend>
        ${radio('mode', 'stop', '<b>Зупинка на помилці</b> — далі лише після правильної клавіші (радимо)', s.mode)}
        ${radio('mode', 'flow', '<b>Без зупинки</b> — помилку позначено, текст іде далі, Backspace повертає', s.mode)}
      </fieldset>
      <fieldset><legend>Клавіатура на екрані</legend>
        <label class="opt"><input type="checkbox" name="keyboard"${s.keyboard ? ' checked' : ''}> Показувати з підсвіткою наступної клавіші</label>
      </fieldset>
      <fieldset><legend>Тема</legend>
        ${radio('theme', 'auto', 'Як у системі', s.theme)}${radio('theme', 'dark', 'Темна', s.theme)}${radio('theme', 'light', 'Світла', s.theme)}
      </fieldset>
    </form>
    <div class="card stack">
      <h2>Резервна копія</h2>
      <p class="muted">Дані зберігаються лише в цьому браузері. Копія — файл, який можна перенести на інший пристрій.</p>
      <div class="row">
        <button type="button" class="btn" id="export">Зберегти копію</button>
        <label class="btn">Відновити з файлу<input type="file" id="import" accept="application/json,.json" hidden></label>
      </div>
      <div class="row"><button type="button" class="btn danger" id="reset">Стерти весь прогрес</button><span id="reset-confirm" hidden><button type="button" class="btn danger" id="reset-yes">Так, стерти</button> <button type="button" class="btn" id="reset-no">Ні</button></span></div>
      <p id="settings-msg" class="muted" role="status"></p>
    </div>
    <p class="muted small about">Буквоїд ${esc(self.APP_VERSION || '')} · друк наосліп, український правопис, англійська. Правопис — за редакцією 2019 року (2019.pravopys.net).</p>`;
  $('settings-form').onchange = () => {
    const f = new FormData($('settings-form'));
    S.update((x) => {
      x.settings.mode = f.get('mode');
      x.settings.theme = f.get('theme');
      x.settings.keyboard = f.get('keyboard') === 'on';
    });
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
    try { S.importJson(await file.text()); applyTheme(); msg('Прогрес відновлено з копії.'); } catch (err) { msg(`Не вдалося відновити: ${err.message}`); }
  };
  $('reset').onclick = () => { $('reset-confirm').hidden = false; };
  $('reset-no').onclick = () => { $('reset-confirm').hidden = true; };
  $('reset-yes').onclick = () => { S.reset(); applyTheme(); renderSettings(); $('settings-msg').textContent = 'Прогрес стерто.'; };
}

// ---------- Каркас ----------

function applyTheme() {
  const pref = set().theme;
  const light = pref === 'light' || (pref === 'auto' && matchMedia('(prefers-color-scheme: light)').matches);
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  try { localStorage.setItem('bukvoid:theme', pref); } catch { /* приватний режим */ }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
}

function go(hash) {
  location.hash = hash;
}

function route() {
  const [name, ...args] = (location.hash.slice(1) || 'druk').split('/');
  const views = {
    druk: renderDruk, lesson: renderLesson, free: renderFree, pravopys: renderPravopys, topic: renderTopic,
    english: renderEnglish, unit: renderUnit, srs: renderSrs, progress: renderProgress, settings: renderSettings,
  };
  const fn = views[name] || renderDruk;
  document.querySelectorAll('.tabs a').forEach((a) => {
    const on = a.dataset.tab === (TABS[name] || 'druk');
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
matchMedia('(prefers-color-scheme: light)').addEventListener('change', applyTheme);
window.addEventListener('hashchange', route);
route();
registerWorker();
// Справжня розкладка (Chromium на комп'ютері) — з першого натискання, коли сторінка вже в фокусі
document.addEventListener('keydown', () => { detectLayout(); }, { once: true });
detectLayout();
