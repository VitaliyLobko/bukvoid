// Перевірка курсу перед додаванням: node tools/check-course.mjs <курс.json>…  (без аргументів — усі courses/*.json і каталог)
// Та сама перевірка, що й у застосунку під час «Додати курс із файлу».
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from '../js/courses.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'courses');
let bad = 0;
const fail = (msg) => { console.log(`  ✗ ${msg}`); bad += 1; };

function check(file) {
  console.log(path.relative(root, file) || file);
  let pack;
  try { pack = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { fail(`не JSON: ${e.message}`); return null; }
  const errors = validate(pack);
  errors.forEach(fail);
  if (!errors.length) {
    const ex = pack.units.reduce((n, u) => n + u.exercises.length, 0);
    console.log(`  ✓ «${pack.title}» v${pack.version ?? 1}: ${pack.units.length} юнітів, ${ex} вправ, ${(fs.statSync(file).size / 1024).toFixed(0)} КБ`);
  }
  return pack;
}

const args = process.argv.slice(2);
if (args.length) {
  args.forEach((f) => check(path.resolve(f)));
} else {
  // Каталог має збігатися з файлами: id, version і кількість юнітів показуються ще до завантаження курсу
  const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
  const listed = new Set();
  for (const c of index.courses) {
    listed.add(c.file);
    const pack = check(path.join(dir, c.file));
    if (!pack) continue;
    if (pack.id !== c.id) fail(`index.json: id ${c.id}, у файлі ${pack.id}`);
    if ((pack.version ?? 1) !== c.version) fail(`index.json: version ${c.version}, у файлі ${pack.version ?? 1}`);
    if (pack.units?.length !== c.units) fail(`index.json: units ${c.units}, у файлі ${pack.units?.length}`);
  }
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.json') && f !== 'index.json' && !listed.has(f)) fail(`${f} немає в index.json`);
}
console.log(bad ? `Помилок: ${bad}` : 'OK');
process.exit(bad ? 1 : 0);
