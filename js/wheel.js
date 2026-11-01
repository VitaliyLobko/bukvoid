/** Стрічка-колесо фонів — як у Shooter's Log (js/ui.js wheelStrip). */

/**
 * Стрічка-колесо з плиток item: плитка посередині — в рамці, onFocus(плитка) вибирає її; тап — прокрутити до неї.
 * Мишею: коліщатко — на плитку вперед/назад, тачпад гортає плавно; стрічку можна тягнути, клік після перетягування не вибирає.
 */
export function wheelStrip(strip, onFocus, item = '.bg-pick') {
  // Клацання під пальцем, коли посередину стає інша плитка — лише від руки, не від програмного прокручування
  let last = null; let touched = false;
  strip.addEventListener('pointerdown', () => { touched = true; });
  strip.addEventListener('wheel', () => { touched = true; }, { passive: true });
  const focusMid = () => {
    const mid = strip.scrollLeft + strip.clientWidth / 2; let best = null; let gap = Infinity;
    strip.querySelectorAll(item).forEach((b) => {
      const d = Math.abs(b.offsetLeft + b.offsetWidth / 2 - mid);
      if (d < gap) { gap = d; best = b; }
    });
    strip.querySelectorAll(`${item}.focus`).forEach((b) => b !== best && b.classList.remove('focus'));
    best?.classList.add('focus');
    if (best && best !== last) { if (touched && last) navigator.vibrate?.(6); last = best; }
    if (best) onFocus(best);
  };
  let raf = 0;
  strip.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(focusMid); }, { passive: true });
  let wheelTo = null;
  const centerOn = (b) => strip.scrollTo({ left: b.offsetLeft + b.offsetWidth / 2 - strip.clientWidth / 2,
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  strip.addEventListener('wheel', (e) => {
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (!d) return;
    e.preventDefault();
    if (e.deltaMode === 0 && Math.abs(d) < 40) { strip.scrollLeft += d; return; }
    const from = wheelTo ?? strip.querySelector(`${item}.focus`);
    const to = d > 0 ? from?.nextElementSibling : from?.previousElementSibling;
    if (to) { wheelTo = to; centerOn(to); }
  }, { passive: false });
  strip.addEventListener('scrollend', () => { wheelTo = null; touched = false; });
  let drag = null;
  strip.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button === 0) drag = { x: e.clientX, left: strip.scrollLeft, moved: false };
  });
  strip.addEventListener('pointermove', (e) => {
    if (!drag || !(e.buttons & 1)) return;
    if (!drag.moved && Math.abs(e.clientX - drag.x) > 4) { drag.moved = true; strip.style.scrollSnapType = 'none'; strip.setPointerCapture(e.pointerId); }
    if (drag.moved) strip.scrollLeft = drag.left - (e.clientX - drag.x);
  });
  const dragEnd = () => {
    if (!drag) return;
    if (drag.moved) {
      strip.style.scrollSnapType = '';
      const b = strip.querySelector(`${item}.focus`); if (b) centerOn(b);
      setTimeout(() => { drag = null; }, 0);
    } else drag = null;
  };
  strip.addEventListener('click', (e) => { if (drag?.moved) { e.stopPropagation(); e.preventDefault(); } }, true);
  strip.addEventListener('pointerup', dragEnd);
  strip.addEventListener('pointercancel', dragEnd);
  return {
    centerOn,
    // Відступи по краях — щоб і крайня плитка ставала в рамку посередині; вибрана — одразу в рамці, сторінка не гортається
    settle: (on) => {
      if (!strip.clientWidth) return;
      strip.style.paddingInline = `${Math.max(0, strip.clientWidth / 2 - 22)}px`;
      strip.scrollLeft = on ? on.offsetLeft + on.offsetWidth / 2 - strip.clientWidth / 2 : 0;
      focusMid();
    },
  };
}
