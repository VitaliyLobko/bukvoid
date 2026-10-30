// Пакет курсу в Node — для перевірки, збирання і перегляду: читає .json, папку з course.json або .zip,
// пише .zip. Розбір архіву й перевірки — ті самі, що в застосунку (js/courses.js).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { readZip, isAsset } from '../js/courses.js';

/** Файли папки (рекурсивно), шляхи через «/» відносно неї. */
export const walk = (dir) => fs.readdirSync(dir, { recursive: true })
  .map((f) => String(f).replace(/\\/g, '/'))
  .filter((f) => fs.statSync(path.join(dir, f)).isFile());

/** Курс: { pack, files: {шлях: Blob} } з .json, папки з course.json чи архіву .zip. */
export async function readPackage(p) {
  if (fs.statSync(p).isDirectory()) {
    const pack = JSON.parse(fs.readFileSync(path.join(p, 'course.json'), 'utf8'));
    const files = {};
    for (const f of walk(p)) if (isAsset(f)) files[f] = new Blob([fs.readFileSync(path.join(p, f))]);
    return { pack, files };
  }
  const buf = fs.readFileSync(p);
  if (buf[0] === 0x50 && buf[1] === 0x4b) return readZip(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  return { pack: JSON.parse(buf.toString('utf8')), files: {} };
}

/**
 * Архів із [[шлях, Buffer]]. Дата файлів стала (1980-01-01) — незмінений курс дає той самий архів байт у байт.
 * Стискаємо deflate, якщо це щось дає (PNG і WebP уже стиснуті — їх кладемо як є).
 */
export function writeZip(entries) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const [name, data] of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const packed = zlib.deflateRawSync(data, { level: 9 });
    const method = packed.length < data.length ? 8 : 0;
    const body = method ? packed : data;
    const crc = zlib.crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // імена в UTF-8
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0x21, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4);
    dir.writeUInt16LE(20, 6);
    dir.writeUInt16LE(0x0800, 8);
    dir.writeUInt16LE(method, 10);
    dir.writeUInt16LE(0, 12);
    dir.writeUInt16LE(0x21, 14);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(body.length, 20);
    dir.writeUInt32LE(data.length, 24);
    dir.writeUInt16LE(nameBuf.length, 28);
    dir.writeUInt32LE(offset, 42);
    parts.push(local, nameBuf, body);
    central.push(dir, nameBuf);
    offset += 30 + nameBuf.length + body.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, end]);
}
