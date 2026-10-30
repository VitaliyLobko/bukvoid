export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** **жирний** і `код` — єдина розмітка всередині текстів курсів. */
export const inline = (s) => esc(s)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');

/** Відносна яскравість кольору #rrggbb за WCAG 2.x. */
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Контраст двох кольорів, від 1 до 21. */
export function contrastRatio(fg, bg) {
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

/** Що дозволяє пара за WCAG: AAA — від 7, AA — від 4.5, великий текст — від 3. */
export function contrastGrade(ratio) {
  if (ratio >= 7) return { mark: 'AAA', text: 'будь-який текст', ok: true };
  if (ratio >= 4.5) return { mark: 'AA', text: 'звичайний текст', ok: true };
  if (ratio >= 3) return { mark: 'AA', text: 'лише великий текст і значки', ok: 'part' };
  return { mark: '✗', text: 'для тексту не годиться', ok: false };
}

const figHtml = (path, alt, caption, src) => {
  const url = src?.(path);
  return `<figure class="fig">${url
    ? `<img src="${esc(url)}" alt="${esc(alt)}" loading="lazy" decoding="async">`
    : `<div class="fig-missing" role="img" aria-label="${esc(alt)}">${esc(alt)}</div>`}`
    + `${caption ? `<figcaption>${inline(caption)}</figcaption>` : ''}</figure>`;
};

/** Картинка вправи — над питанням. */
export const exerciseFig = (ex, src) => (ex.img ? figHtml(ex.img, ex.alt, '', src) : '');

/**
 * Теорія з блоків {h}|{p}|{ul}|{table}|{tip}|{warn}|{img}|{swatches}|{contrast}.
 * src(path) — адреса картинки курсу (Courses.src); без неї замість картинки — її опис.
 */
export function blocksHtml(blocks = [], { src } = {}) {
  return blocks.map((b) => {
    if (b.img) return figHtml(b.img, b.alt, b.caption, src);
    // hex перевірено validate() — у style лише #rrggbb
    if (b.swatches) {
      return `<div class="swatches">${b.swatches.map((c) => `<div class="swatch"><span class="chip" style="background:${esc(c.hex)}"></span>`
        + `<span class="swatch-text">${c.name ? `<b>${inline(c.name)}</b>` : ''}<code>${esc(c.hex.toLowerCase())}</code>${c.note ? `<small>${inline(c.note)}</small>` : ''}</span></div>`).join('')}</div>`;
    }
    if (b.contrast) {
      return `<div class="contrast">${b.contrast.map((c) => {
        const ratio = contrastRatio(c.fg, c.bg);
        const g = contrastGrade(ratio);
        return `<div class="contrast-pair"><div class="contrast-sample" style="color:${esc(c.fg)};background:${esc(c.bg)}">${inline(c.text || 'Текст на тлі')}</div>`
          + `<div class="contrast-verdict ${g.ok === true ? 'good' : g.ok ? 'mid' : 'bad'}"><b>${(Math.floor(ratio * 10) / 10).toFixed(1)}:1</b> <span>${g.mark} · ${g.text}</span>`
          + `<small><code>${esc(c.fg.toLowerCase())}</code> на <code>${esc(c.bg.toLowerCase())}</code></small></div></div>`;
      }).join('')}</div>`;
    }
    if (b.h) return `<h2>${inline(b.h)}</h2>`;
    if (b.p) return `<p>${inline(b.p)}</p>`;
    if (b.ul) return `<ul>${b.ul.map((li) => `<li>${inline(li)}</li>`).join('')}</ul>`;
    if (b.tip) return `<div class="callout tip">${inline(b.tip)}</div>`;
    if (b.warn) return `<div class="callout warn">${inline(b.warn)}</div>`;
    if (b.table) {
      const [head, ...rows] = b.table;
      return `<div class="table-wrap"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead>`
        + `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }
    return '';
  }).join('');
}
