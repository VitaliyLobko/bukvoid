export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** **жирний** і `код` — єдина розмітка всередині текстів курсів. */
export const inline = (s) => esc(s)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');

/** Теорія з блоків {h}|{p}|{ul}|{table}|{tip}|{warn}. */
export function blocksHtml(blocks = []) {
  return blocks.map((b) => {
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
