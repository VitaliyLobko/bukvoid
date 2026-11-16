// Блок коду в курсах: підсвітка без бібліотек — коментарі, рядки, ключові слова, числа, декоратори.
// Мови: python, js, json, bash, sql, console (термінал: «$ команда» і вивід), text (без підсвітки).

export const CODE_LANGS = ['python', 'js', 'json', 'bash', 'sql', 'console', 'text'];

const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const words = (s) => new Set(s.split(' '));

const STR = String.raw`"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'`;
const NUM = String.raw`\b\d[\d_]*(?:\.\d+)?\b`;
const WORD = String.raw`\b[A-Za-z_]\w*\b`;
const NEVER = '(?!)';

// Групи завжди в одному порядку: 1 — коментар, 2 — рядок, 3 — декоратор, 4 — число, 5 — слово
const rule = (com, str, dec, kw) => ({ re: new RegExp(`(${com})|(${str})|(${dec})|(${NUM})|(${WORD})`, 'gm'), kw: words(kw) });

const RULES = {
  python: rule('#[^\\n]*', String.raw`[rRbBfFuU]{0,2}(?:"""[\s\S]*?"""|'''[\s\S]*?'''|${STR})`, String.raw`^[ \t]*@[\w.]+`,
    'False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield'),
  js: rule(String.raw`\/\/[^\n]*|\/\*[\s\S]*?\*\/`, `${STR}|\`(?:[^\`\\\\]|\\\\.)*\``, NEVER,
    'async await break case catch class const continue default delete do else export extends false finally for from function if import in instanceof let new null of return static super switch this throw true try typeof undefined var void while yield'),
  json: rule(NEVER, STR, NEVER, 'true false null'),
  bash: rule(String.raw`(?:^|(?<=\s))#[^\n]*`, STR, NEVER, 'if then else elif fi for in do done while case esac function return export local echo cd'),
  // SQL: рядки лише в одинарних лапках ('' — лапка всередині), "ідентифікатори" — не рядки; слова без огляду на регістр
  sql: {
    ...rule(String.raw`--[^\n]*|\/\*[\s\S]*?\*\/`, `'(?:[^']|'')*'`, NEVER,
      'ADD ALL ALTER ALWAYS ANALYZE AND ANY AS ASC BEGIN BETWEEN BY CASCADE CASE CHECK COLUMN COMMIT COMMITTED CONFLICT '
      + 'CONSTRAINT CREATE CROSS CURRENT DEFAULT DELETE DESC DISTINCT DO DROP ELSE END EXISTS EXPLAIN FALSE FILTER FOLLOWING '
      + 'FOR FOREIGN FROM FULL GENERATED GROUP HAVING IDENTITY IF ILIKE IN INDEX INNER INSERT INTO IS ISOLATION JOIN KEY '
      + 'LATERAL LEFT LEVEL LIKE LIMIT LOCKED NEW NOT NOTHING NOWAIT NULL OFFSET OLD ON OR ORDER OUTER OVER PARTITION '
      + 'PRECEDING PRIMARY RANGE READ RECURSIVE REFERENCES RELEASE REPEATABLE RESTRICT RETURNING RIGHT ROLLBACK ROW ROWS '
      + 'SAVEPOINT SELECT SERIALIZABLE SET SHARE SKIP TABLE THEN TO TRANSACTION TRUE UNBOUNDED UNION UNIQUE UPDATE USING '
      + 'VALUES VIEW WHEN WHERE WINDOW WITH WRITE'),
    ci: true,
  },
};

/** Код → [[текст, клас]]; клас '' — без підсвітки. */
function tokens(code, lang) {
  if (lang === 'console') {
    return code.split('\n').flatMap((line, i) => {
      const nl = i ? [['\n', '']] : [];
      return line.startsWith('$ ') ? [...nl, ['$ ', 'prompt'], [line.slice(2), 'cmd']] : [...nl, [line, '']];
    });
  }
  const r = RULES[lang];
  if (!r) return [[code, '']];
  const out = [];
  let last = 0;
  for (const m of code.matchAll(r.re)) {
    const cls = m[1] ? 'com' : m[2] ? 'str' : m[3] ? 'dec' : m[4] ? 'num' : r.kw.has(r.ci ? m[5].toUpperCase() : m[5]) ? 'kw' : '';
    if (!cls) continue;
    if (m.index > last) out.push([code.slice(last, m.index), '']);
    out.push([m[0], cls]);
    last = m.index + m[0].length;
  }
  out.push([code.slice(last), '']);
  return out;
}

/** Токени → HTML по рядках: багаторядковий рядок чи коментар ріжеться на межі рядків. */
function lines(toks) {
  const res = [''];
  for (const [text, cls] of toks) {
    text.split('\n').forEach((part, i) => {
      if (i) res.push('');
      if (part) res[res.length - 1] += cls ? `<span class="tk-${cls}">${esc(part)}</span>` : esc(part);
    });
  }
  return res;
}

/** Блок коду: {code, lang?, title?, hl?} — hl — номери рядків від 1, що підсвічуються. */
export function codeBlockHtml({ code, lang = 'text', title, hl = [] }) {
  const marks = new Set(hl);
  const rows = lines(tokens(String(code).replace(/\n+$/, ''), lang))
    .map((l, i) => `<span class="code-line${marks.has(i + 1) ? ' hl' : ''}">${l || ' '}</span>`).join('');
  return `<figure class="code${lang === 'console' ? ' term' : ''}">${title ? `<figcaption>${esc(String(title))}</figcaption>` : ''}`
    + `<pre tabindex="0"><code>${rows}</code></pre></figure>`;
}
