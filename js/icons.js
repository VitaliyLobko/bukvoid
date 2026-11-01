// Значки курсів: курс вибирає ключ (поле icon), малюнок — наш. Довільного SVG з файлу курсу не беремо:
// курс — дані з будь-якого джерела, а SVG у сторінці — це вже розмітка.
const P = {
  book: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z"/>',
  keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M7.5 14h9"/>',
  pen: '<path d="M4 20l4-1L19 8l-3-3L5 16z"/><path d="M14 7l3 3"/><path d="M13 20h7"/>',
  languages: '<path d="M4 5h9M8.5 5c0 5-2 8-5 10M6 9c1.5 3 4 5 7 6"/><path d="M13 21l4-9 4 9M14.5 18h5"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.4A4.6 4.6 0 0 0 21 9.8C21 6 17 3 12 3z"/><path d="M7.5 11h.01M9.5 7h.01M14.5 7h.01M17 10.5h.01"/>',
  layout: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11"/>',
  geometry: '<path d="M4 20L12 4l8 16z"/><path d="M8.5 14h7"/>',
  math: '<path d="M17 5H7l6 7-6 7h10"/>',
  flask: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3"/><path d="M7.5 15h9"/>',
  leaf: '<path d="M5 19C5 11 11 5 20 5c0 9-6 15-14 15"/><path d="M5 19l7-7"/>',
  landmark: '<path d="M3 21h18M4 10h16M12 3l9 5H3z"/><path d="M6 10v8M10 10v8M14 10v8M18 10v8"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  code: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
  heart: '<path d="M12 20s-7-4.5-9-9a4.5 4.5 0 0 1 9-3 4.5 4.5 0 0 1 9 3c-2 4.5-9 9-9 9z"/>',
  idea: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
};

export const ICONS = Object.keys(P);

// Значки рядків налаштувань — лише для інтерфейсу, курсам недоступні
const UI = {
  stop: '<path d="M8.2 3h7.6L21 8.2v7.6L15.8 21H8.2L3 15.8V8.2z"/><path d="M12 7.5v5.5M12 16.5h.01"/>',
  type: '<path d="M5 7V5h14v2M12 5v14M9 19h6"/>',
  server: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/>',
  cloud: '<path d="M7 18.5a4.5 4.5 0 0 1-.5-9 6 6 0 0 1 11.6 1.6 3.7 3.7 0 0 1-.6 7.4z"/>',
  save: '<path d="M12 4v11M8 11l4 4 4-4"/><path d="M5 15v5h14v-5"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 13h11l1-13M9 7V4h6v3"/>',
};

/** SVG значка; невідомий ключ — книжка. */
export const iconSvg = (key) => `<svg viewBox="0 0 24 24" aria-hidden="true">${P[key] || P.book}</svg>`;
export const uiSvg = (key) => `<svg viewBox="0 0 24 24" aria-hidden="true">${UI[key] || P[key]}</svg>`;
