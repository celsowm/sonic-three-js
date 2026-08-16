/**
 * Generates the Green Hill stage textures as authored PNG asset files.
 *
 * Deterministic, dependency-free (PNG encoding via node:zlib). Run with
 * `npm run assets:textures:green-hill`; outputs are committed to the repo
 * under assets/textures/green-hill/.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUTPUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'textures', 'green-hill');

// Classic Sonic 1 Green Hill palette sampled from the original tileset.
const PALETTE = {
  checkerLight: [0xd8, 0x6c, 0x00],
  checkerDark: [0x6c, 0x24, 0x00],
  bandDark: [0x24, 0x00, 0x00],
  grass: [0x48, 0xb4, 0x00],
  grassLight: [0x90, 0xfc, 0x00],
  grassDark: [0x00, 0x6c, 0x00],
  grassDarkest: [0x00, 0x48, 0x00],
};

/** Deterministic noise so regenerating always produces identical files. */
const hash = (x, y, seed = 0) => {
  let value = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  value = (value ^ (value >>> 13)) * 1274126177;
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
};

const shade = (rgb, factor) => rgb.map(channel => Math.max(0, Math.min(255, Math.round(channel * factor))));

// --- minimal PNG encoder (RGB, 8-bit, no interlace) ---

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

const crc32 = (buffer) => {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
};

const encodePng = (width, height, pixels) => {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    Buffer.from(pixels.buffer, pixels.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // color type: truecolor
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

const writeTexture = (name, width, height, paint) => {
  const pixels = new Uint8Array(width * height * 3);
  const setPixel = (x, y, rgb) => {
    const offset = (y * width + x) * 3;
    pixels[offset] = rgb[0];
    pixels[offset + 1] = rgb[1];
    pixels[offset + 2] = rgb[2];
  };
  paint(setPixel, width, height);
  const path = join(OUTPUT_DIR, `${name}.png`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, encodePng(width, height, pixels));
  console.log(`wrote ${path} (${width}x${height})`);
};

/**
 * Checkerboard with subtle per-square shading variation, so it reads as a
 * textured surface instead of flat alternating colors.
 */
const paintChecker = (setPixel, width, height, square, light, dark, seed) => {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const col = Math.floor(x / square);
      const row = Math.floor(y / square);
      const base = (col + row) % 2 === 0 ? light : dark;
      const variation = 0.94 + hash(col, row, seed) * 0.12;
      setPixel(x, y, shade(base, variation));
    }
  }
};

/**
 * Grass seen from above: streaky columns of green (darker and lighter
 * strands running along one axis) with occasional bright glints.
 */
const paintGrassTop = (setPixel, width, height) => {
  for (let x = 0; x < width; x += 1) {
    // each column leans lighter or darker; strand segments modulate it
    const columnBias = hash(x, 7) * 0.16 - 0.08;
    for (let y = 0; y < height; y += 1) {
      const strand = Math.floor(y / 6);
      const bias = columnBias + (hash(x, strand, 3) * 0.14 - 0.07);
      setPixel(x, y, shade(PALETTE.grass, 1 + bias));
    }
  }
  for (let i = 0; i < 26; i += 1) {
    const x = Math.floor(hash(i, 11, 5) * width);
    const y = Math.floor(hash(i, 13, 6) * height);
    setPixel(x, y, PALETTE.grassLight);
    setPixel((x + 1) % width, y, shade(PALETTE.grassLight, 0.9));
  }
};

/**
 * Grass rim seen from the front: bright dappled green with a dark boundary
 * band at the bottom where it meets the dirt.
 */
const paintGrassFront = (setPixel, width, height) => {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const noise = hash(x, y, 9);
      let color = PALETTE.grass;
      if (y < height * 0.6) {
        if (noise < 0.16 + (height * 0.6 - y) / height * 0.2) color = PALETTE.grassLight;
      } else if (noise < 0.14 + (y - height * 0.6) / height * 0.9) {
        color = y > height * 0.85 ? PALETTE.grassDarkest : PALETTE.grassDark;
      }
      setPixel(x, y, color);
    }
  }
  for (let i = 0; i < 12; i += 1) {
    setPixel(Math.floor(hash(i, 21, 8) * width), Math.floor(hash(i, 23, 10) * height * 0.3), [0xfc, 0xfc, 0xfc]);
  }
};

writeTexture('dirt-checker', 256, 256, (setPixel, w, h) =>
  paintChecker(setPixel, w, h, 32, PALETTE.checkerLight, PALETTE.checkerDark, 1));
writeTexture('dirt-band', 256, 64, (setPixel, w, h) =>
  paintChecker(setPixel, w, h, 32, PALETTE.checkerDark, PALETTE.bandDark, 2));
writeTexture('grass-top', 256, 256, paintGrassTop);
writeTexture('grass-front', 256, 64, paintGrassFront);

const metadata = {
  name: 'Green Hill Stage Textures',
  source: 'Generated procedurally by scripts/generate-green-hill-textures.mjs; palette sampled from the Sonic 1 Green Hill tileset.',
  files: ['dirt-checker.png', 'dirt-band.png', 'grass-top.png', 'grass-front.png'],
  generatedAt: new Date().toISOString(),
};
mkdirSync(OUTPUT_DIR, { recursive: true });
writeFileSync(join(OUTPUT_DIR, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`);
console.log(`wrote ${join(OUTPUT_DIR, 'metadata.json')}`);
