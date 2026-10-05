import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPng(width, height, drawFn) {
  // RGBA buffer: 4 bytes per pixel + 1 filter byte per scanline
  const rowSize = width * 4;
  const rawData = Buffer.alloc(height * (1 + rowSize));

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + rowSize);
    rawData[rowOffset] = 0; // Filter type 0 (None)

    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawFn(x, y, width, height);
      const pixelOffset = rowOffset + 1 + x * 4;
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const deflated = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth: 8
  ihdrData[9] = 6; // Color type: 6 (RGBA)
  ihdrData[10] = 0; // Compression method: 0
  ihdrData[11] = 0; // Filter method: 0
  ihdrData[12] = 0; // Interlace method: 0
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // IDAT chunk
  const idatChunk = makeChunk('IDAT', deflated);

  // IEND chunk
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const length = data.length;
  const chunk = Buffer.alloc(12 + length);
  chunk.writeUInt32BE(length, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);

  const crc = crc32(chunk.subarray(4, 8 + length));
  chunk.writeUInt32BE(crc, 8 + length);
  return chunk;
}

// Precomputed CRC32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Drawing: Branded Campus Connect LPU Icon
// Vibrant Orange background (#ea580c -> [234, 88, 12]) with rounded corners, academic emblem and "CC" letters
function drawIcon(x, y, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const r = w * 0.46; // Rounded icon container

  const distSq = Math.hypot(x - cx, y - cy);

  // Gradient background from #f97316 to #c2410c
  const t = y / h;
  const bgR = Math.round(249 - t * (249 - 194));
  const bgG = Math.round(115 - t * (115 - 65));
  const bgB = Math.round(22 - t * (22 - 12));

  // Outer circle / squircle mask
  if (distSq > r) {
    return [0, 0, 0, 0]; // Transparent outside
  }

  // Draw Cap / Diamond in center
  const dx = Math.abs(x - cx);
  const dy = Math.abs(y - (cy - h * 0.08));

  // Diamond shape for mortarboard
  if (dx / (w * 0.32) + dy / (h * 0.16) <= 1) {
    return [255, 255, 255, 255]; // White cap top
  }

  // Cap skullcap underneath
  if (dx <= w * 0.18 && y >= cy - h * 0.04 && y <= cy + h * 0.12) {
    return [255, 255, 255, 240];
  }

  // Tassel drop
  if (x >= cx + w * 0.28 && x <= cx + w * 0.32 && y >= cy - h * 0.08 && y <= cy + h * 0.18) {
    return [254, 240, 138, 255]; // Golden tassel
  }

  // "LPU" stripe / banner below cap
  if (y >= cy + h * 0.20 && y <= cy + h * 0.30 && dx <= w * 0.35) {
    return [255, 255, 255, 230];
  }

  return [bgR, bgG, bgB, 255];
}

const outDir = path.resolve(process.cwd(), 'public', 'icons');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

fs.writeFileSync(path.join(outDir, 'icon-192.png'), createPng(192, 192, drawIcon));
fs.writeFileSync(path.join(outDir, 'icon-512.png'), createPng(512, 512, drawIcon));

console.log('Successfully generated icon-192.png and icon-512.png in public/icons/');
