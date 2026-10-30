import { esc, inline } from './blocks.js';

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

const TYPE_LABEL = { choice: 'Оберіть варіант', gap: 'Впишіть пропущене', fix: 'Виправте помилку — надрукуйте речення цілком', translate: 'Перекладіть англійською' };

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Тест: по одному завданню, перевірка Enter-ом, наприкінці — підсумок і
 * «Повторити помилки». onDone(score, total) — лише для повного проходу.
 */
export function mountQuiz(root, exercises, { onDone, labels = {} } = {}) {
  let list = exercises.map((ex, i) => ({ ...ex, i }));
  let idx = 0;
  let right = 0;
  let wrong = [];
  let full = true;

  function show() {
    if (idx >= list.length) return summary();
    const ex = list[idx];
    const label = labels[ex.type] || TYPE_LABEL[ex.type] || '';
    let body;
    if (ex.type === 'choice') {
      const opts = shuffle(ex.options.map((o, i) => ({ o, ok: i === ex.a })));
      body = `<div class="q-options">${opts.map((x, n) => `<button type="button" class="q-opt" data-ok="${x.ok ? 1 : 0}"><kbd>${n + 1}</kbd>${esc(x.o)}</button>`).join('')}</div>`;
    } else {
      body = `<form class="q-form"><input class="q-input" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Відповідь" placeholder="${ex.type === 'gap' ? 'пропущене' : 'речення'}"><button type="submit" class="btn primary">Перевірити</button></form>`;
    }
    root.innerHTML = `
      <div class="quiz">
        <div class="q-progress"><span style="width:${(idx / list.length) * 100}%"></span></div>
        <div class="q-meta muted">${idx + 1} з ${list.length} · ${esc(label)}</div>
        <div class="q-text">${inline(ex.q).replace(/◻|___/g, '<span class="gap">◻</span>')}</div>
        ${body}
        <div class="q-feedback" role="status" hidden></div>
      </div>`;
    const fb = root.querySelector('.q-feedback');
    const done = (ok, given) => {
      if (ok) right += 1; else wrong.push(ex);
      const answer = ex.type === 'choice' ? ex.options[ex.a] : ex.a[0];
      fb.hidden = false;
      fb.className = `q-feedback ${ok ? 'good' : 'bad'}`;
      fb.innerHTML = `<b>${ok ? 'Правильно' : 'Не так'}</b>${ok ? '' : `${given ? `: ви написали «${esc(given)}»` : ''}. Правильно: <b>${esc(answer)}</b>`}`
        + (ex.why ? `<p>${inline(ex.why)}</p>` : '')
        + '<button type="button" class="btn primary q-next">Далі <kbd>Enter</kbd></button>';
      const next = fb.querySelector('.q-next');
      next.onclick = () => { idx += 1; show(); };
      next.focus();
    };
    if (ex.type === 'choice') {
      const buttons = [...root.querySelectorAll('.q-opt')];
      buttons.forEach((b) => {
        b.onclick = () => {
          buttons.forEach((x) => { x.disabled = true; if (x.dataset.ok === '1') x.classList.add('good'); });
          if (b.dataset.ok !== '1') b.classList.add('bad');
          done(b.dataset.ok === '1', b.dataset.ok === '1' ? '' : b.textContent.slice(1));
        };
      });
      root.querySelector('.quiz').tabIndex = -1;
      root.querySelector('.quiz').focus({ preventScroll: true });
    } else {
      const input = root.querySelector('.q-input');
      root.querySelector('.q-form').onsubmit = (e) => {
        e.preventDefault();
        if (!input.value.trim()) return;
        input.disabled = true;
        root.querySelector('.q-form button').disabled = true;
        const ok = isRight(input.value, ex.a);
        input.classList.add(ok ? 'good' : 'bad');
        done(ok, input.value.trim());
      };
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
