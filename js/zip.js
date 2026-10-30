// Читання .zip без бібліотек: центральний каталог з кінця файлу, deflate — через DecompressionStream браузера.
// Розміри беремо з центрального каталогу: у локальних заголовках їх може не бути (біт 3, «data descriptor»).

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;

/** ArrayBuffer → Map(шлях → Uint8Array). maxBytes — межа розпакованого (від «zip-бомби»). */
export async function unzip(buf, { maxBytes = Infinity } = {}) {
  const u8 = new Uint8Array(buf);
  const dv = new DataView(buf);
  let end = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 22 - 0xffff); i -= 1) {
    if (dv.getUint32(i, true) === EOCD) { end = i; break; }
  }
  if (end < 0) throw new Error('Це не архів .zip.');
  const count = dv.getUint16(end + 10, true);
  const dirAt = dv.getUint32(end + 16, true);
  if (count === 0xffff || dirAt === 0xffffffff) throw new Error('Архів завеликий (zip64) — для курсу таких не буває.');
  const names = new TextDecoder();
  const entries = [];
  let p = dirAt;
  let total = 0;
  for (let n = 0; n < count; n += 1) {
    if (dv.getUint32(p, true) !== CENTRAL) throw new Error('Архів пошкоджено.');
    const method = dv.getUint16(p + 10, true);
    const packed = dv.getUint32(p + 20, true);
    const size = dv.getUint32(p + 24, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const noteLen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = names.decode(u8.subarray(p + 46, p + 46 + nameLen)).replace(/\\/g, '/');
    p += 46 + nameLen + extraLen + noteLen;
    if (name.endsWith('/')) continue;
    total += size;
    if (total > maxBytes) throw new Error(`Архів завеликий: розпакований понад ${Math.round(maxBytes / 1e6)} МБ.`);
    entries.push({ name, method, packed, size, local });
  }
  const out = new Map();
  for (const e of entries) {
    const start = e.local + 30 + dv.getUint16(e.local + 26, true) + dv.getUint16(e.local + 28, true);
    const data = u8.subarray(start, start + e.packed);
    let bytes;
    if (e.method === 0) bytes = data.slice();
    else if (e.method === 8) bytes = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    else throw new Error(`Файл ${e.name} стиснуто непідтримуваним способом.`);
    if (bytes.length !== e.size) throw new Error(`Файл ${e.name} в архіві пошкоджено.`);
    out.set(e.name, bytes);
  }
  return out;
}
