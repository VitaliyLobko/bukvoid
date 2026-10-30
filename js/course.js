import { WORDS, TEXTS } from './data/words.js';

// Урок = нові клавіші; вправи складаються лише з уже вивчених.
const STAGES = {
  uk: [
    ['Основний ряд', 'фіваолдж'], ['Вказівні тягнуться: П і Р', 'пр'], ['Верхній ряд: Е і Н', 'ен'],
    ['К і Г', 'кг'], ['У і Ш', 'уш'], ['Ц і Щ', 'цщ'], ['Й і З', 'йз'], ['Х і Ї', 'хї'],
    ['Нижній ряд: М і Т', 'мт'], ['И і Ь', 'иь'], ['С і Б', 'сб'], ['Ч і Ю', 'чю'], ['Я і крапка', 'я.'],
    ['Є, апостроф і Ґ', "є'ґ"],
  ],
  ru: [
    ['Основной ряд', 'фываолдж'], ['П и Р', 'пр'], ['Верхний ряд: Е и Н', 'ен'], ['К и Г', 'кг'], ['У и Ш', 'уш'],
    ['Ц и Щ', 'цщ'], ['Й и З', 'йз'], ['Х и Ъ', 'хъ'], ['Нижний ряд: М и Т', 'мт'], ['И и Ь', 'иь'],
    ['С и Б', 'сб'], ['Ч и Ю', 'чю'], ['Я и точка', 'я.'], ['Э и Ё', 'эё'],
  ],
  en: [
    ['Home row', 'asdfjkl;'], ['G and H', 'gh'], ['E and I', 'ei'], ['R and U', 'ru'], ['T and Y', 'ty'],
    ['W and O', 'wo'], ['Q and P', 'qp'], ['V and M', 'vm'], ['C and comma', 'c,'], ['X and period', 'x.'],
    ['B and N', 'bn'], ['Z and slash', 'z/'], ["Apostrophe", "'"],
  ],
};

const EXTRA = [
  { id: 'caps', title: 'Великі літери: Shift', note: 'Shift тисне мізинець протилежної руки. Літера ліворуч — правий Shift, праворуч — лівий.' },
  { id: 'punct', title: 'Розділові знаки', note: 'Кома, знак оклику, питання, двокрапка, дефіс. Після розділового знака — пробіл.' },
  { id: 'digits', title: 'Цифри', note: 'Цифри — тим самим пальцем, що й літера під нею: 4 і 5 — лівий вказівний, 6 і 7 — правий.' },
  { id: 'texts', title: 'Справжній текст', note: 'Речення цілком: великі літери, знаки, пробіли. Рівний ритм важливіший за швидкість.' },
];

export const PASS_ACC = 97;

export function lessons(lang) {
  const learned = [];
  const out = STAGES[lang].map(([title, raw], n) => {
    const fresh = [...raw];
    learned.push(...fresh);
    return { id: `${lang}:${n + 1}`, n: n + 1, title, fresh, learned: [...learned], kind: 'keys' };
  });
  EXTRA.forEach((x, i) => out.push({ ...x, id: `${lang}:${x.id}`, n: out.length + 1, fresh: [], learned: [...learned], kind: x.id, order: i }));
  return out;
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const letters = (set) => set.filter((c) => /\p{L}/u.test(c));

function groups(pool, count, min, max) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const len = min + Math.floor(Math.random() * (max - min + 1));
    let g = '';
    for (let j = 0; j < len; j += 1) g += pick(pool);
    out.push(g);
  }
  return out.join(' ');
}

const shuffled = (arr) => [...arr].sort(() => Math.random() - 0.5);

function wordsFrom(lang, allowed, fresh, count) {
  const ok = new Set(allowed);
  const all = WORDS[lang].filter((w) => [...w].every((c) => ok.has(c)));
  const withFresh = all.filter((w) => fresh.some((c) => w.includes(c)));
  const src = withFresh.length >= count / 2 ? withFresh : all;
  return shuffled(src).slice(0, count);
}

const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);

/** Три вправи уроку: нові клавіші, сполучення, слова. */
export function exercisesFor(lang, lesson) {
  const { fresh, learned } = lesson;
  const pool = letters(learned);
  if (lesson.kind === 'keys') {
    const anchors = letters(learned.slice(0, 8));
    const a = groups([...fresh, ...fresh, ...fresh, ...anchors.slice(0, 2)].filter((c) => c !== ' '), 14, 2, 4);
    const b = groups([...fresh, ...fresh, ...pool], 14, 3, 5);
    let words = wordsFrom(lang, learned, fresh, 14);
    const c = words.length >= 6 ? words.join(' ') : groups([...fresh, ...pool], 14, 3, 6);
    return [
      { key: 'a', title: 'Нові клавіші', text: a },
      { key: 'b', title: 'Сполучення', text: b },
      { key: 'c', title: words.length >= 6 ? 'Слова' : 'Склади', text: c },
    ];
  }
  const all = WORDS[lang];
  if (lesson.kind === 'caps') {
    return [
      { key: 'a', title: 'Слова з великої', text: shuffled(all).slice(0, 12).map(cap).join(' ') },
      { key: 'b', title: 'Через одне', text: shuffled(all).slice(0, 12).map((w, j) => (j % 2 ? w : cap(w))).join(' ') },
      { key: 'c', title: 'Речення', text: shuffled(TEXTS[lang]).slice(0, 2).join(' ') },
    ];
  }
  if (lesson.kind === 'punct') {
    const marks = [',', ',', '.', '!', '?', ':', ';'];
    const mk = () => shuffled(all).slice(0, 12).map((w, j) => (j % 2 ? `${w}${pick(marks)}` : w)).join(' ').replace(/[,.!?:;]?$/, '.');
    const hyph = () => shuffled(all).slice(0, 10).map((w, j) => (j % 3 === 2 ? `${w} -` : w)).join(' ') + '.';
    return [{ key: 'a', title: 'Кома й крапка', text: mk() }, { key: 'b', title: 'Усі знаки', text: mk() }, { key: 'c', title: 'Дефіс і тире', text: hyph() }];
  }
  if (lesson.kind === 'digits') {
    const num = () => String(Math.floor(Math.random() * (Math.random() < 0.5 ? 100 : 10000)));
    return [
      { key: 'a', title: 'Ряд цифр', text: groups([...'1234567890'], 14, 2, 4) },
      { key: 'b', title: 'Числа', text: Array.from({ length: 12 }, num).join(' ') },
      { key: 'c', title: 'Слова й числа', text: shuffled(all).slice(0, 10).map((w) => `${w} ${num()}`).join(' ') },
    ];
  }
  const texts = shuffled(TEXTS[lang]);
  return ['a', 'b', 'c'].map((key, i) => ({ key, title: `Текст ${i + 1}`, text: texts.slice(i * 2, i * 2 + 2).join(' ') }));
}

/** Тренування з найслабших клавіш: частка помилок і повільність. */
export function weakKeys(keyStats = {}, limit = 6) {
  return Object.entries(keyStats)
    .filter(([ch, k]) => ch !== ' ' && k.n + k.e >= 8)
    .map(([ch, k]) => ({ ch, rate: k.e / (k.n + k.e), ms: k.n ? k.t / k.n : 0, n: k.n, e: k.e }))
    .sort((a, b) => b.rate - a.rate || b.ms - a.ms)
    .slice(0, limit);
}

export function weakText(lang, weak) {
  const chars = weak.map((w) => w.ch.toLowerCase()).filter((c) => /\p{L}/u.test(c));
  if (!chars.length) return null;
  const words = shuffled(WORDS[lang].filter((w) => chars.some((c) => w.includes(c)))).slice(0, 16);
  return `${groups([...chars, ...chars], 6, 2, 4)} ${words.join(' ')}`;
}

export function wordsText(lang, n = 18) {
  return shuffled(WORDS[lang]).slice(0, n).join(' ');
}

export function textsText(lang, n = 3) {
  return shuffled(TEXTS[lang]).slice(0, n).join(' ');
}

// Теорія перед курсом друку.
export const THEORY = [
  {
    id: 'why', title: 'Чому помилки, коли поспішаєш',
    blocks: [
      { p: 'Помилка друку — це не «неуважність», а рух, який рука ще не запам\'ятала. Коли поспішаєте, мозок не встигає контролювати палець, і той б\'є «приблизно туди».' },
      { p: 'Тому курс побудовано навпаки до звички: **спершу точність, швидкість прийде сама**. Урок зараховано лише за точності від 97%. Швидкість показуємо, але не вимагаємо.' },
      { tip: 'Правило: якщо помилок більше ніж 3 на 100 знаків — пригальмуйте. Рівний повільний ритм швидше перетворюється на швидкий, ніж рваний швидкий — на точний.' },
      { p: 'Режим «зупинка на помилці» (за замовчуванням) не пускає далі, доки не натиснете правильну клавішу. Так рука одразу вчиться правильного руху, а не виправлення.' },
    ],
  },
  {
    id: 'home', title: 'Як ставити руки',
    blocks: [
      { p: 'Ліва рука лежить на **Ф І В А**, права — на **О Л Д Ж** (в англійській розкладці — A S D F і J K L ;). Великі пальці — над пробілом. Це **основна позиція**: з неї починається кожне натискання й сюди ж палець повертається.' },
      { p: 'На клавішах **А** та **О** (F і J) є рисочки. Знайдіть їх вказівними пальцями наосліп — так рука стає на місце без погляду вниз.' },
      { ul: ['Кожна клавіша — свій палець, завжди той самий. Колір пальця на схемі збігається з кольором його зони на клавіатурі.', 'Вказівні пальці працюють за двох: лівий ще й **П**, **К**, **Е**, **М**, **И**, правий — **Р**, **Н**, **Г**, **Т**, **Ь**.', 'Пробіл — великим пальцем; Shift — мізинцем протилежної руки.', 'Не тягніться всією рукою: рухається лише палець, долоня лишається над основним рядом.'] },
    ],
  },
  {
    id: 'body', title: 'Постава',
    blocks: [
      { ul: ['Сидіть рівно, ступні на підлозі, лікті — під прямим кутом, біля тулуба.', 'Зап\'ястки не лежать на столі й не провисають: пальці злегка зігнуті, ніби тримаєте яблуко.', 'Екран — на рівні очей, клавіатура — прямо перед вами (літера Н/Y — по центру тіла).', 'Б\'ємо легко й коротко, кінчиками пальців. Тиснути з силою не треба.'] },
    ],
  },
  {
    id: 'how', title: 'Як тренуватися',
    blocks: [
      { ul: ['**15–20 хвилин щодня** дають більше, ніж дві години раз на тиждень.', '**Не дивіться на руки.** Підглядати можна на екранну клавіатуру — для того вона й є.', 'Розминка — 2 хвилини вправи «Слабкі клавіші»: застосунок сам збирає літери, на яких ви помиляєтеся.', 'Вивчені розкладки одразу використовуйте в роботі: повертаючись до «двох пальців», рука розучується.'] },
      { table: [['Рівень', 'Знаків за хвилину'], ['Початок курсу', '60–100'], ['Після курсу', '150–200'], ['Впевнено', '250–300'], ['Професійно', '350+']] },
      { p: 'Українська й англійська розкладки вчаться окремо: у кожної свій курс (перемикач мови над уроками).' },
    ],
  },
];
