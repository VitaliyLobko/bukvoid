import { esc, inline, exerciseFig } from './blocks.js';

// Скорочення розгортаємо з обох боків: «I'm» і «I am» — одна відповідь.
const CONTRACTIONS = [
  [/\bwon't\b/g, 'will not'], [/\bcan't\b/g, 'can not'], [/\bcannot\b/g, 'can not'], [/\bshan't\b/g, 'shall not'],
  [/n't\b/g, ' not'], [/'m\b/g, ' am'], [/'re\b/g, ' are'], [/'ve\b/g, ' have'], [/'ll\b/g, ' will'], [/'d\b/g, ' would'],
];

/** Порівнюємо без регістру, виду апострофа, розділових знаків і зайвих пробілів. */
export function normalize(s) {
  let t = String(s).toLowerCase().replace(/[ʼ’`‘]/g, "'").replace(/[“”«»"]/g, '');
  for (const [re, to] of CONTRACTIONS) t = t.replace(re, to);
  return t.replace(/[.,!?;:]/g, ' ').replace(/\s+/g, ' ').trim();
}

export const isRight = (given, answers) => answers.some((a) => normalize(a) === normalize(given));

/** Число з відповіді: кома як крапка, пробіли між розрядами, одиниці після числа ігноруємо. */
export const parseNumber = (s) => {
  const m = String(s).replace(/\s+/g, '').replace(',', '.').match(/^[-−+]?\d*\.?\d+/);
  return m ? Number(m[0].replace('−', '-')) : NaN;
};
export const numberRight = (given, ex) => Math.abs(parseNumber(given) - ex.a) <= (ex.tol ?? 0) + 1e-9;

const TYPE_LABEL = {
  choice: 'Оберіть варіант', gap: 'Впишіть пропущене', fix: 'Виправте помилку — надрукуйте речення цілком',
  translate: 'Перекладіть англійською', number: 'Впишіть число', order: 'Розставте по порядку', spot: 'Торкніться потрібного місця на малюнку',
};

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Правильна відповідь словами — для «Правильно: …» після помилки. */
function answerText(ex) {
  if (ex.type === 'choice') return ex.options[ex.a];
  if (ex.type === 'number') return `${ex.a}${ex.unit ?? ''}`;
  if (ex.type === 'order') return ex.items.join(' → ');
  if (ex.type === 'spot') return '';
  return ex.a[0];
}

/**
 * Тест: по одному завданню, перевірка Enter-ом, наприкінці — підсумок і
 * «Повторити помилки». onDone(score, total) — лише для повного проходу.
 * onAnswer(ex, ok) і onTime(ms, ex) — після кожної відповіді (ex — вправа з полями, які передали).
 * src(path, ex) — адреса картинки курсу для вправ з img; ex.from — підпис, звідки вправа.
 */
export function mountQuiz(root, exercises, { onDone, onTime, onAnswer, labels = {}, src } = {}) {
  let list = exercises.map((ex, i) => ({ ...ex, i }));
  let shownAt = 0;
  let idx = 0;
  let right = 0;
  let wrong = [];
  let full = true;

  function show() {
    if (idx >= list.length) return summary();
    const ex = list[idx];
    const exSrc = src ? (path) => src(path, ex) : undefined;
    const label = labels[ex.type] || TYPE_LABEL[ex.type] || '';
    let body;
    if (ex.type === 'choice') {
      const opts = shuffle(ex.options.map((o, i) => ({ o, ok: i === ex.a })));
      body = `<div class="q-options">${opts.map((x, n) => `<button type="button" class="q-opt" data-ok="${x.ok ? 1 : 0}"><kbd>${n + 1}</kbd>${esc(x.o)}</button>`).join('')}</div>`;
    } else if (ex.type === 'order') {
      // Перемішуємо так, щоб початковий порядок не збігся з правильним
      let items = shuffle(ex.items.map((t, k) => ({ t, k })));
      while (items.every((x, n) => x.k === n)) items = shuffle(items);
      body = `<ol class="q-order" aria-label="Ваш порядок"></ol>
        <div class="q-pool">${items.map((x) => `<button type="button" class="q-item" data-k="${x.k}">${esc(x.t)}</button>`).join('')}</div>
        <div class="row"><button type="button" class="btn primary" data-act="check" disabled>Перевірити</button><button type="button" class="btn" data-act="reset">Скинути</button></div>`;
    } else if (ex.type === 'spot') {
      const url = exSrc?.(ex.img);
      body = `<div class="spot"><img src="${esc(url || '')}" alt="${esc(ex.alt)}" draggable="false"><span class="spot-mark" hidden></span><span class="spot-zone" hidden></span></div>`;
    } else {
      const num = ex.type === 'number';
      body = `<form class="q-form"><input class="q-input" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"${num ? ' inputmode="decimal"' : ''} aria-label="Відповідь" placeholder="${num ? `число${ex.unit ? `, ${esc(ex.unit.trim())}` : ''}` : ex.type === 'gap' ? 'пропущене' : 'речення'}"><button type="submit" class="btn primary">Перевірити</button></form>`;
    }
    root.innerHTML = `
      <div class="quiz">
        <div class="q-progress"><span style="width:${(idx / list.length) * 100}%"></span></div>
        <div class="q-meta muted">${idx + 1} з ${list.length} · ${esc(label)}${ex.from ? ` · ${esc(ex.from)}` : ''}</div>
        ${ex.type === 'spot' ? '' : exerciseFig(ex, exSrc)}
        <div class="q-text">${inline(ex.q).replace(/◻|___/g, '<span class="gap">◻</span>')}</div>
        ${body}
        <div class="q-feedback" role="status" hidden></div>
      </div>`;
    const fb = root.querySelector('.q-feedback');
    shownAt = Date.now();
    const done = (ok, given) => {
      onTime?.(Date.now() - shownAt, ex);
      onAnswer?.(ex, ok);
      if (ok) right += 1; else wrong.push(ex);
      const answer = answerText(ex);
      fb.hidden = false;
      fb.className = `q-feedback ${ok ? 'good' : 'bad'}`;
      const fix = [given && `Ви написали «${esc(given)}».`, answer ? `Правильно: <b>${esc(answer)}</b>` : ex.type === 'spot' && 'Правильне місце обведено.'].filter(Boolean).join(' ');
      fb.innerHTML = `<b>${ok ? 'Правильно' : 'Не так'}</b>${ok || !fix ? '' : `<p>${fix}</p>`}`
        + (ex.why ? `<p>${inline(ex.why)}</p>` : '')
        + '<button type="button" class="btn primary q-next">Далі <kbd>Enter</kbd></button>';
      const next = fb.querySelector('.q-next');
      next.onclick = () => { idx += 1; show(); };
      next.focus();
    };
    const quiz = root.querySelector('.quiz');
    if (ex.type === 'choice') {
      const buttons = [...root.querySelectorAll('.q-opt')];
      buttons.forEach((b) => {
        b.onclick = () => {
          buttons.forEach((x) => { x.disabled = true; if (x.dataset.ok === '1') x.classList.add('good'); });
          if (b.dataset.ok !== '1') b.classList.add('bad');
          done(b.dataset.ok === '1', b.dataset.ok === '1' ? '' : b.textContent.slice(1));
        };
      });
      quiz.tabIndex = -1;
      quiz.focus({ preventScroll: true });
    } else if (ex.type === 'order') {
      const ol = root.querySelector('.q-order');
      const pool = root.querySelector('.q-pool');
      const check = root.querySelector('[data-act="check"]');
      // Торкнулись у запасі — пункт іде в кінець відповіді; у відповіді — повертається в запас
      const move = (b) => {
        if (b.closest('.q-pool')) { const li = document.createElement('li'); li.append(b); ol.append(li); } else { const li = b.parentElement; pool.append(b); li.remove(); }
        check.disabled = pool.children.length > 0;
      };
      root.querySelectorAll('.q-item').forEach((b) => { b.onclick = () => move(b); });
      root.querySelector('[data-act="reset"]').onclick = () => { [...ol.querySelectorAll('.q-item')].forEach(move); };
      check.onclick = () => {
        const got = [...ol.querySelectorAll('.q-item')];
        const ok = got.every((b, n) => Number(b.dataset.k) === n);
        got.forEach((b, n) => { b.disabled = true; b.classList.add(Number(b.dataset.k) === n ? 'good' : 'bad'); });
        root.querySelectorAll('[data-act]').forEach((b) => { b.disabled = true; });
        done(ok, ok ? '' : got.map((b) => b.textContent).join(' → '));
      };
      quiz.tabIndex = -1;
      quiz.focus({ preventScroll: true });
    } else if (ex.type === 'spot') {
      const box = root.querySelector('.spot');
      const img = box.querySelector('img');
      let answered = false;
      img.onclick = (e) => {
        if (answered) return;
        answered = true;
        const r = img.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * 100;
        const y = ((e.clientY - r.top) / r.height) * 100;
        // Відстань у пікселях: r цілі — відсоток ширини картинки
        const ok = Math.hypot(((x - ex.a.x) / 100) * r.width, ((y - ex.a.y) / 100) * r.height) <= (ex.a.r / 100) * r.width;
        const mark = box.querySelector('.spot-mark');
        Object.assign(mark.style, { left: `${x}%`, top: `${y}%` });
        mark.hidden = false;
        mark.classList.add(ok ? 'good' : 'bad');
        const zone = box.querySelector('.spot-zone');
        Object.assign(zone.style, { left: `${ex.a.x}%`, top: `${ex.a.y}%`, width: `${ex.a.r * 2}%` });
        zone.hidden = false;
        box.classList.add('answered');
        done(ok, '');
      };
    } else {
      const input = root.querySelector('.q-input');
      root.querySelector('.q-form').onsubmit = (e) => {
        e.preventDefault();
        if (!input.value.trim()) return;
        if (ex.type === 'number' && Number.isNaN(parseNumber(input.value))) { input.setCustomValidity('Впишіть число'); input.reportValidity(); return; }
        input.setCustomValidity('');
        input.disabled = true;
        root.querySelector('.q-form button').disabled = true;
        const ok = ex.type === 'number' ? numberRight(input.value, ex) : isRight(input.value, ex.a);
        input.classList.add(ok ? 'good' : 'bad');
        done(ok, input.value.trim());
      };
      input.oninput = () => input.setCustomValidity('');
      input.focus({ preventScroll: true });
    }
  }

  function summary() {
    const total = list.length;
    if (full) onDone?.(right, total);
    const pct = Math.round((right / total) * 100);
    root.innerHTML = `
      <div class="quiz summary">
        <div class="big-score">${right}<small> / ${total}</small></div>
        <p>${pct === 100 ? 'Без жодної помилки. Буквоїд аплодує.' : pct >= 80 ? 'Добре. Помилки варто пройти ще раз — саме на них закріплюється правило.' : 'Перечитайте правило вгорі й повторіть помилки.'}</p>
        <div class="row">
          ${wrong.length ? '<button type="button" class="btn primary" data-act="wrong">Повторити помилки</button>' : ''}
          <button type="button" class="btn" data-act="again">Пройти знову</button>
        </div>
      </div>`;
    const again = (items, isFull) => { list = items; idx = 0; right = 0; wrong = []; full = isFull; show(); };
    root.querySelector('[data-act="again"]').onclick = () => again(exercises.map((ex, i) => ({ ...ex, i })), true);
    const w = root.querySelector('[data-act="wrong"]');
    if (w) { const items = wrong; w.onclick = () => again(items, false); }
  }

  // Цифри 1–4 обирають варіант, Enter — «Далі»
  root.onkeydown = (e) => {
    if (e.target.matches('input')) return;
    const n = Number(e.key);
    const opts = root.querySelectorAll('.q-opt:not(:disabled)');
    if (n >= 1 && n <= opts.length) { e.preventDefault(); opts[n - 1].click(); }
  };

  show();
}
