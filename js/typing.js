import { ROWS, FINGER_NAMES, HOME, finger, layout, locate, shiftFor, script, LANG_NAMES } from './layouts.js';
import { esc } from './blocks.js';

// Пауза довша за цю не рахується в час: відволіклися — швидкість не падає.
const IDLE_MS = 2000;

const normApos = (ch) => (/[ʼ’`‘]/.test(ch) ? "'" : ch);

const LAYOUT_HINT = { lat: 'англійська', uk: 'українська', ru: 'російська', cyr: 'кирилична' };
const TARGET_SCRIPT = { uk: 'uk', ru: 'ru', en: 'lat' };

/** Клавіатура на екрані: кольори зон пальців, підсвітка наступної клавіші. */
export function keyboardHtml(lang, { zones = false } = {}) {
  const keys = layout(lang);
  const homeCodes = new Set(Object.values(HOME));
  const rows = ROWS.map((row, i) => {
    const pre = ['', '<span class="key wide-1" data-code="Tab">Tab</span>', '<span class="key wide-2" data-code="CapsLock">Caps</span>', '<span class="key wide-3" data-code="ShiftLeft">Shift</span>'][i];
    const post = ['<span class="key wide-1" data-code="Backspace">⌫</span>', '', '<span class="key wide-2" data-code="Enter">Enter</span>', '<span class="key wide-3" data-code="ShiftRight">Shift</span>'][i];
    const cells = row.map((code) => {
      const k = keys[code];
      const label = /\p{L}/u.test(k.lower) ? k.lower.toUpperCase() : k.lower;
      const up = k.upper && !/\p{L}/u.test(k.upper) ? `<small>${esc(k.upper)}</small>` : '';
      return `<span class="key${homeCodes.has(code) ? ' home' : ''}" data-code="${code}" data-f="${finger(code)}">${up}${esc(label)}</span>`;
    }).join('');
    return `<div class="kb-row">${pre}${cells}${post}</div>`;
  }).join('');
  return `<div class="kb${zones ? ' zones' : ''}" aria-hidden="true">${rows}<div class="kb-row"><span class="key space" data-code="Space" data-f="t"></span></div></div>`;
}

/** Дві руки з пальців у кольорах зон: над кожним пальцем — його клавіша основного ряду. */
export function handsHtml(lang) {
  const keys = layout(lang);
  const label = (f) => { const ch = keys[HOME[f]].lower; return /\p{L}/u.test(ch) ? ch.toUpperCase() : ch; };
  const finger = (f, name) => `<div class="finger f-${f}" data-f="${f}"><kbd>${esc(label(f))}</kbd><span>${name}</span></div>`;
  const hand = (side, list) => `<figure class="hand hand-${side}">
      <div class="fingers">${list.map(([f, n]) => finger(f, n)).join('')}</div>
      <div class="thumb" data-f="t"><span>великий: пробіл</span></div>
      <figcaption>${side === 'l' ? 'Ліва рука' : 'Права рука'}</figcaption>
    </figure>`;
  return `<div class="hands">
    ${hand('l', [['l1', 'мізинець'], ['l2', 'безіменний'], ['l3', 'середній'], ['l4', 'вказівний']])}
    ${hand('r', [['r4', 'вказівний'], ['r3', 'середній'], ['r2', 'безіменний'], ['r1', 'мізинець']])}
  </div>`;
}

/**
 * Вправа на друк. Символи ловимо з поля введення (подія input), а не з keydown:
 * так працює будь-яка розкладка й екранна клавіатура телефона.
 */
export function mountTyping(root, { text, lang, mode = 'stop', keyboard = true, onDone, title = '' }) {
  const keys = layout(lang);
  const chars = [...text];
  const stats = {};
  let pos = 0;
  let errors = 0;
  let activeMs = 0;
  let last = 0;
  let wrongHere = false;
  const gaps = [];

  root.innerHTML = `
    <div class="typer">
      ${title ? `<div class="typer-title">${esc(title)}</div>` : ''}
      <div class="typer-stats">
        <span><b data-s="acc">100</b>% точність</span>
        <span><b data-s="cpm">0</b> зн/хв</span>
        <span><b data-s="left">${chars.length}</b> лишилось</span>
      </div>
      <div class="typer-text" tabindex="0">${chars.map((c) => `<span${c === ' ' ? ' class="sp"' : ''}>${esc(c)}</span>`).join('')}</div>
      <div class="typer-hint muted" data-s="hint"></div>
      <div class="typer-warn" data-s="warn" hidden></div>
      <input class="typer-input" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Поле набору">
      ${keyboard ? keyboardHtml(lang) : ''}
      <p class="typer-focus muted" data-s="focus" hidden>Клацніть по тексту, щоб продовжити</p>
    </div>`;

  const $ = (s) => root.querySelector(`[data-s="${s}"]`);
  const input = root.querySelector('.typer-input');
  const spans = [...root.querySelectorAll('.typer-text > span')];
  const kb = root.querySelector('.kb');

  const focus = () => input.focus({ preventScroll: true });
  root.querySelector('.typer').addEventListener('click', focus);
  input.addEventListener('blur', () => { if (pos < chars.length) $('focus').hidden = false; });
  input.addEventListener('focus', () => { $('focus').hidden = true; });

  function paint() {
    spans.forEach((s) => s.classList.remove('cur'));
    if (pos < spans.length) {
      spans[pos].classList.add('cur');
      spans[pos].scrollIntoView({ block: 'nearest' });
    }
    if (kb) {
      kb.querySelectorAll('.next').forEach((k) => k.classList.remove('next'));
      const exp = chars[pos];
      const where = exp != null ? locate(keys, normApos(exp)) : null;
      if (where) {
        kb.querySelector(`[data-code="${where.code}"]`)?.classList.add('next');
        if (where.shift) kb.querySelector(`[data-code="${shiftFor(where.code)}"]`)?.classList.add('next');
      }
    }
    const exp = chars[pos];
    if (exp != null) {
      const where = locate(keys, normApos(exp));
      const label = exp === ' ' ? 'пробіл' : `«${exp}»`;
      $('hint').textContent = where
        ? `${label} — ${FINGER_NAMES[finger(where.code)]}${where.shift ? `, Shift — ${where.code && finger(where.code).startsWith('l') ? 'правий' : 'лівий'} мізинець` : ''}`
        : label;
    }
    const total = mode === 'flow' ? pos : pos + errors;
    $('acc').textContent = total ? Math.round(((total - errors) / total) * 1000) / 10 : 100;
    $('cpm').textContent = activeMs > 1500 ? Math.round(pos / (activeMs / 60000)) : 0;
    $('left').textContent = chars.length - pos;
  }

  function tick() {
    const now = performance.now();
    const dt = last ? Math.min(now - last, IDLE_MS) : 0;
    last = now;
    activeMs += dt;
    return dt;
  }

  function warnLayout(typed, exp) {
    const got = script(typed);
    const want = TARGET_SCRIPT[lang];
    const mismatch = got && script(exp) && (got === 'lat') !== (want === 'lat');
    const ukRu = got && ((want === 'uk' && got === 'ru') || (want === 'ru' && got === 'uk'));
    if (mismatch || ukRu) {
      $('warn').hidden = false;
      $('warn').textContent = `Здається, увімкнена ${LAYOUT_HINT[got]} розкладка. Перемкніть на ${LANG_NAMES[lang].toLowerCase().replace(/а$/, 'у')} (Win+Пробіл або Alt+Shift).`;
    } else {
      $('warn').hidden = true;
    }
  }

  function press(raw) {
    if (pos >= chars.length) return;
    const typed = normApos(raw);
    const exp = normApos(chars[pos]);
    const dt = tick();
    const st = (stats[chars[pos]] ||= { n: 0, e: 0, t: 0 });
    if (typed === exp) {
      st.n += 1;
      st.t += dt;
      if (dt) gaps.push(dt);
      spans[pos].classList.add(wrongHere ? 'fixed' : 'ok');
      spans[pos].classList.remove('bad');
      wrongHere = false;
      pos += 1;
      $('warn').hidden = true;
    } else {
      errors += 1;
      st.e += 1;
      warnLayout(typed, exp);
      spans[pos].classList.remove('shake');
      void spans[pos].offsetWidth;
      spans[pos].classList.add('bad', 'shake');
      if (mode === 'flow') {
        st.n += 1;
        spans[pos].classList.add('miss');
        pos += 1;
      } else {
        wrongHere = true;
      }
    }
    paint();
    if (pos >= chars.length) finish();
  }

  function finish() {
    input.blur();
    const total = chars.length + (mode === 'flow' ? 0 : errors);
    const correct = mode === 'flow' ? chars.length - errors : chars.length;
    const acc = Math.round((correct / Math.max(total, 1)) * 1000) / 10;
    const cpm = Math.round(chars.length / Math.max(activeMs / 60000, 1 / 60));
    onDone?.({ acc, cpm, errors, chars: chars.length, ms: Math.round(activeMs), keyStats: stats, rhythm: rhythm(gaps) });
  }

  input.addEventListener('input', () => {
    const value = input.value;
    input.value = '';
    for (const ch of value) press(ch);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && mode === 'flow' && pos > 0) {
      e.preventDefault();
      pos -= 1;
      spans[pos].classList.remove('ok', 'bad', 'miss', 'fixed');
      paint();
    } else if (e.key === 'Enter') {
      e.preventDefault();
    }
  });

  paint();
  setTimeout(focus, 30);
  return { focus };
}

/** Рівність ритму, 0–100: наскільки однакові проміжки між натисканнями. */
function rhythm(gaps) {
  if (gaps.length < 8) return null;
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const sd = Math.sqrt(gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / gaps.length);
  return Math.max(0, Math.round(100 - (sd / mean) * 100));
}
