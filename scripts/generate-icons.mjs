// Uses Next.js's existing sharp dependency; no asset service or network request.
import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const svg = await readFile(new URL('../app/icon.svg', import.meta.url));
const images = await Promise.all([16, 32].map(size => sharp(svg).resize(size, size).png().toBuffer()));
const header = Buffer.alloc(6 + 16 * images.length); header.writeUInt16LE(1, 2); header.writeUInt16LE(images.length, 4);
let offset = header.length;
images.forEach((buffer, index) => {
  const entry = 6 + index * 16, size = [16, 32][index]; header[entry] = size; header[entry + 1] = size;
  header.writeUInt16LE(1, entry + 4); header.writeUInt16LE(32, entry + 6); header.writeUInt32LE(buffer.length, entry + 8); header.writeUInt32LE(offset, entry + 12); offset += buffer.length;
});
await mkdir(new URL('../public/', import.meta.url), { recursive: true });
await Promise.all([
  writeFile(new URL('../app/favicon.ico', import.meta.url), Buffer.concat([header, ...images])),
  writeFile(new URL('../public/flowra-16.png', import.meta.url), images[0]),
  writeFile(new URL('../public/flowra-32.png', import.meta.url), images[1]),
  sharp(svg).resize(180, 180).png().toFile(new URL('../app/apple-icon.png', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'))
]);
console.log('Generated Flowra ICO (16/32 px), PNG previews and Apple icon.');
