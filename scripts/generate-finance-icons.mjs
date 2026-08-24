// Generates the finance app's home-screen icons.
//
// iOS accepts PNG only for apple-touch-icon — no SVG, no WebP — and fills any
// transparency with black, so the artwork is drawn fully opaque. The icon is also
// left square on purpose: iOS applies its own corner mask, and pre-rounding it
// produces a visible double-rounded edge.
//
// Encoded here with zlib rather than through an image library so regenerating the
// icons needs no native dependency. Run: node scripts/generate-finance-icons.mjs

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public');

// Warm cream to match the app's light surface (#FBF9F6), with three bars drawn
// straight from the category palette in types.ts.
const BACKGROUND = [251, 249, 246];
const BARS = [
  { alpha: 1.0, color: [245, 158, 11] }, // amber  — mercado
  { alpha: 1.0, color: [56, 189, 248] }, // sky    — transporte
  { alpha: 1.0, color: [22, 197, 94] }, //  green  — ingreso
];

const crcTable = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

const crc32 = (buffer) => {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
};

const encodePng = (width, height, rgba) => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  // One filter byte (0 = None) per scanline.
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

/** Ascending bars — a balance that trends up, in the app's own accent colour. */
const draw = (size) => {
  const rgba = Buffer.alloc(size * size * 4);

  // Opaque background.
  for (let i = 0; i < size * size; i += 1) {
    rgba[i * 4] = BACKGROUND[0];
    rgba[i * 4 + 1] = BACKGROUND[1];
    rgba[i * 4 + 2] = BACKGROUND[2];
    rgba[i * 4 + 3] = 255;
  }

  const unit = size / 180; // geometry authored against a 180px grid
  const barWidth = Math.round(26 * unit);
  const gap = Math.round(18 * unit);
  const left = Math.round(34 * unit);
  const baseline = Math.round(146 * unit);
  const heights = [40, 68, 100].map((h) => Math.round(h * unit));

  BARS.forEach((bar, index) => {
    const x0 = left + index * (barWidth + gap);
    const y0 = baseline - heights[index];

    for (let y = y0; y < baseline; y += 1) {
      for (let x = x0; x < x0 + barWidth; x += 1) {
        if (x < 0 || x >= size || y < 0 || y >= size) continue;
        const i = (y * size + x) * 4;
        // Composite over the background so alpha never reaches the file.
        for (let c = 0; c < 3; c += 1) {
          rgba[i + c] = Math.round(bar.color[c] * bar.alpha + rgba[i + c] * (1 - bar.alpha));
        }
        rgba[i + 3] = 255;
      }
    }
  });

  return encodePng(size, size, rgba);
};

mkdirSync(OUT_DIR, { recursive: true });
for (const size of [180, 192, 512]) {
  const file = resolve(OUT_DIR, `finanzas-icon-${size}.png`);
  writeFileSync(file, draw(size));
  console.log(`wrote ${file}`);
}
