// Перевірка курсу перед додаванням: node tools/check-course.mjs <курс.json | курс.zip | папка курсу>…
// Без аргументів — усі курси каталогу (courses/*.json і папки courses/<id>/) і їхня відповідність index.json.
// Та сама перевірка, що й у застосунку під час «Додати курс із файлу».
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate, checkFiles, assetsOf } from '../js/courses.js';
import { readPackage } from './pack.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'courses');
let bad = 0;
const fail = (msg) => { console.log(`  ✗ ${msg}`); bad += 1; };
const kb = (n) => `${(n / 1024).toFixed(0)} КБ`;

async function check(file) {
  console.log(path.relative(root, file) || file);
  let pack;
  let files;
  try { ({ pack, files } = await readPackage(file)); } catch (e) { fail(`не прочитався: ${e.message}`); return null; }
  const errors = [...validate(pack, new Set(Object.keys(files))), ...await checkFiles(files)];
  errors.forEach(fail);
  if (!errors.length) {
    const ex = pack.units.reduce((n, u) => n + u.exercises.length, 0);
    const used = assetsOf(pack);
    const size = fs.statSync(file).isDirectory()
      ? fs.statSync(path.join(file, 'course.json')).size + [...used].reduce((n, f) => n + files[f].size, 0)
      : fs.statSync(file).size;
    const extra = Object.keys(files).filter((f) => !used.has(f));
    console.log(`  ✓ «${pack.title}» v${pack.version ?? 1}: ${pack.units.length} юнітів, ${ex} вправ${used.size ? `, ${used.size} картинок` : ''}, ${kb(size)}`);
    if (extra.length) console.log(`  ⚠ зайві файли, курс на них не посилається: ${extra.join(', ')}`);
  }
  return pack;
}

const args = process.argv.slice(2);
if (args.length) {
  for (const f of args) await check(path.resolve(f));
} else {
  // Каталог має збігатися з файлами: id, version і кількість юнітів показуються ще до завантаження курсу
  const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
  const listed = new Set();
  for (const c of index.courses) {
    if (Boolean(c.dir) === Boolean(c.file)) { fail(`index.json: у ${c.id} має бути або file, або dir`); continue; }
    listed.add(c.dir || c.file);
    const pack = await check(path.join(dir, c.dir || c.file));
    if (!pack) continue;
    if (pack.id !== c.id) fail(`index.json: id ${c.id}, у файлі ${pack.id}`);
    if ((pack.version ?? 1) !== c.version) fail(`index.json: version ${c.version}, у файлі ${pack.version ?? 1}`);
    if (pack.units?.length !== c.units) fail(`index.json: units ${c.units}, у файлі ${pack.units?.length}`);
  }
  for (const f of fs.readdirSync(dir)) {
    const isDir = fs.statSync(path.join(dir, f)).isDirectory();
    if ((isDir || (f.endsWith('.json') && f !== 'index.json')) && !listed.has(f)) fail(`${f}${isDir ? '/' : ''} немає в index.json`);
  }
}
console.log(bad ? `Помилок: ${bad}` : 'OK');
process.exit(bad ? 1 : 0);
