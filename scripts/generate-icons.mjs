// Generates build/icon.png (512x512) and a multi-resolution build/icon.ico for electron-builder.
// Pure Node: PNG is deflate-compressed RGBA drawn with supersampling; the ICO wraps PNG frames.
// Run: npm run icons
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT_DIR = join(process.cwd(), "build");
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

function encodePng(width, height, pixels) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * stride;
    raw[rowStart] = 0;
    pixels.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

// --- geometry ---------------------------------------------------------------------------------

function roundedRect(x, y, x0, y0, x1, y1, r) {
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r || (x >= x0 && x <= x1 && y >= y0 && y <= y1);
}

function inRect(x, y, x0, y0, x1, y1) {
  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

function inCircle(x, y, cx, cy, r) {
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

// --- drawing ----------------------------------------------------------------------------------

const TILE = { r: 0x15, g: 0x17, b: 0x1b, a: 1 };
const PAGE = { r: 0xee, g: 0xf1, b: 0xf4, a: 1 };
const LINE = { r: 0xb0, g: 0xb8, b: 0xc2, a: 1 };
const HIGHLIGHT = { r: 0xff, g: 0xe0, b: 0x66, a: 0.9 };
const BUBBLE = { r: 0x4c, g: 0x8d, b: 0xff, a: 1 };
const DOT = { r: 0xff, g: 0xff, b: 0xff, a: 1 };

function over(dst, src) {
  const a = src.a + dst.a * (1 - src.a);
  if (a <= 0) return { r: 0, g: 0, b: 0, a: 0 };
  return {
    r: (src.r * src.a + dst.r * dst.a * (1 - src.a)) / a,
    g: (src.g * src.a + dst.g * dst.a * (1 - src.a)) / a,
    b: (src.b * src.a + dst.b * dst.a * (1 - src.a)) / a,
    a
  };
}

function sample(x, y, N) {
  // Painter's order: tile, page, text lines, highlighter, chat bubble, bubble dots.
  let c = { r: 0, g: 0, b: 0, a: 0 };

  if (roundedRect(x, y, 0, 0, N, N, 0.22 * N)) c = over(c, TILE);

  const page = roundedRect(x, y, 0.2 * N, 0.14 * N, 0.66 * N, 0.86 * N, 0.055 * N);
  if (page) c = over(c, PAGE);

  if (roundedRect(x, y, 0.245 * N, 0.375 * N, 0.62 * N, 0.465 * N, 0.02 * N)) c = over(c, HIGHLIGHT);

  const lines = [
    { y: 0.28, w: 0.32 },
    { y: 0.4, w: 0.32 },
    { y: 0.52, w: 0.32 },
    { y: 0.64, w: 0.2 }
  ];
  for (const line of lines) {
    if (inRect(x, y, 0.27 * N, line.y * N, (0.27 + line.w) * N, line.y * N + 0.04 * N)) {
      c = over(c, LINE);
    }
  }

  if (roundedRect(x, y, 0.55 * N, 0.58 * N, 0.9 * N, 0.86 * N, 0.1 * N)) c = over(c, BUBBLE);
  for (const dx of [0.635, 0.7, 0.765]) {
    if (inCircle(x, y, dx * N, 0.72 * N, 0.026 * N)) c = over(c, DOT);
  }

  return c;
}

function render(size) {
  const N = size;
  const S = N <= 32 ? 6 : 4; // more supersampling where it matters most
  const pixels = Buffer.alloc(N * N * 4);

  for (let y = 0; y < N; y += 1) {
    for (let x = 0; x < N; x += 1) {
      let ar = 0;
      let ag = 0;
      let ab = 0;
      let aa = 0;
      for (let sy = 0; sy < S; sy += 1) {
        for (let sx = 0; sx < S; sx += 1) {
          const c = sample(x + (sx + 0.5) / S, y + (sy + 0.5) / S, N);
          ar += c.r * c.a;
          ag += c.g * c.a;
          ab += c.b * c.a;
          aa += c.a;
        }
      }
      const index = (y * N + x) * 4;
      const alpha = aa / (S * S);
      pixels[index] = aa > 0 ? Math.round(ar / aa) : 0;
      pixels[index + 1] = aa > 0 ? Math.round(ag / aa) : 0;
      pixels[index + 2] = aa > 0 ? Math.round(ab / aa) : 0;
      pixels[index + 3] = Math.round(alpha * 255);
    }
  }
  return encodePng(N, N, pixels);
}

function buildIco(frames) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  const entries = Buffer.alloc(16 * frames.length);
  let offset = 6 + 16 * frames.length;
  frames.forEach((frame, i) => {
    const at = i * 16;
    entries[at] = frame.size >= 256 ? 0 : frame.size;
    entries[at + 1] = frame.size >= 256 ? 0 : frame.size;
    entries[at + 2] = 0;
    entries[at + 3] = 0;
    entries.writeUInt16LE(1, at + 4);
    entries.writeUInt16LE(32, at + 6);
    entries.writeUInt32LE(frame.png.length, at + 8);
    entries.writeUInt32LE(offset, at + 12);
    offset += frame.png.length;
  });
  return Buffer.concat([header, entries, ...frames.map((frame) => frame.png)]);
}

mkdirSync(OUT_DIR, { recursive: true });
const png512 = render(512);
writeFileSync(join(OUT_DIR, "icon.png"), png512);
const ico = buildIco(ICO_SIZES.map((size) => ({ size, png: render(size) })));
writeFileSync(join(OUT_DIR, "icon.ico"), ico);
console.log(
  `Wrote build/icon.png (${png512.length} bytes) and build/icon.ico (${ico.length} bytes, ${ICO_SIZES.length} sizes)`
);
