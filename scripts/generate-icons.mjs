// Generates build/icon.png (512x512) and build/icon.ico (256x256) for electron-builder.
// Pure Node: PNG is deflate-compressed RGBA drawn with supersampling; ICO wraps a PNG frame.
// Run: node scripts/generate-icons.mjs
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT_DIR = join(process.cwd(), "build");

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
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
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

function roundedRect(x, y, x0, y0, x1, y1, r) {
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r || (x >= x0 && x <= x1 && y >= y0 && y <= y1);
}

function inRect(x, y, x0, y0, x1, y1) {
  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

function render(size) {
  const N = size;
  const S = 4; // supersamples per axis
  const pixels = Buffer.alloc(N * N * 4);
  const bg = [0x16, 0x18, 0x1c];
  const line = [0xe6, 0xe8, 0xec];
  const weak = [0x9a, 0xa1, 0xab];
  const accent = [0x4c, 0x8d, 0xff];

  const r = 0.18 * N;
  const lineH = 0.055 * N;
  const lines = [
    { y: 0.30 * N, w: 0.56, c: line },
    { y: 0.42 * N, w: 0.50, c: weak },
    { y: 0.54 * N, w: 0.56, c: weak },
    { y: 0.66 * N, w: 0.34, c: weak }
  ];

  for (let y = 0; y < N; y += 1) {
    for (let x = 0; x < N; x += 1) {
      let covered = 0;
      let rr = 0;
      let gg = 0;
      let bb = 0;

      for (let sy = 0; sy < S; sy += 1) {
        for (let sx = 0; sx < S; sx += 1) {
          const px = x + (sx + 0.5) / S;
          const py = y + (sy + 0.5) / S;
          if (!roundedRect(px, py, 0, 0, N, N, r)) continue;
          covered += 1;
          let color = bg;
          if (inRect(px, py, 0.66 * N, 0.20 * N, 0.78 * N, 0.62 * N)) color = accent;
          for (const l of lines) {
            if (inRect(px, py, 0.20 * N, l.y, (0.20 + l.w) * N, l.y + lineH)) color = l.c;
          }
          rr += color[0];
          gg += color[1];
          bb += color[2];
        }
      }

      const index = (y * N + x) * 4;
      pixels[index] = covered ? Math.round(rr / covered) : 0;
      pixels[index + 1] = covered ? Math.round(gg / covered) : 0;
      pixels[index + 2] = covered ? Math.round(bb / covered) : 0;
      pixels[index + 3] = Math.round((covered / (S * S)) * 255);
    }
  }
  return encodePng(N, N, pixels);
}

function buildIco(pngBuffer, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry[0] = size >= 256 ? 0 : size;
  entry[1] = size >= 256 ? 0 : size;
  entry[2] = 0;
  entry[3] = 0;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(pngBuffer.length, 8);
  entry.writeUInt32LE(6 + 16, 12);
  return Buffer.concat([header, entry, pngBuffer]);
}

mkdirSync(OUT_DIR, { recursive: true });
const png512 = render(512);
writeFileSync(join(OUT_DIR, "icon.png"), png512);
const png256 = render(256);
writeFileSync(join(OUT_DIR, "icon.ico"), buildIco(png256, 256));
console.log(`Wrote build/icon.png (${png512.length} bytes) and build/icon.ico`);
