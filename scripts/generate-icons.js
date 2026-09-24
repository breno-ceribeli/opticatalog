const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const SIZE = 1024;
const GRAD_TOP = [59, 130, 246];
const GRAD_BOTTOM = [29, 78, 216];

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
  for (let y = 0; y < SIZE; y++) {
    raw[y * (SIZE * 4 + 1)] = 0;
    rgba.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function gradAt(y) {
  const t = y / (SIZE - 1);
  return [
    Math.round(lerp(GRAD_TOP[0], GRAD_BOTTOM[0], t)),
    Math.round(lerp(GRAD_TOP[1], GRAD_BOTTOM[1], t)),
    Math.round(lerp(GRAD_TOP[2], GRAD_BOTTOM[2], t)),
  ];
}

function clamp(v) {
  return Math.max(0, Math.min(1, v));
}

function annulus(d, inner, outer) {
  if (d < inner) return clamp((d - inner + 1) / 1);
  if (d > outer) return clamp((outer + 1 - d) / 1);
  return 1;
}

function drawRing(buffer, cx, cy, radius, thickness, colorFn) {
  const inner = radius - thickness / 2;
  const outer = radius + thickness / 2;
  for (let y = Math.max(0, cy - outer - 1); y <= Math.min(SIZE - 1, cy + outer + 1); y++) {
    for (let x = Math.max(0, cx - outer - 1); x <= Math.min(SIZE - 1, cx + outer + 1); x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      const cov = annulus(d, inner, outer);
      if (cov <= 0) continue;
      const [r, g, b] = colorFn(x, y);
      const idx = (y * SIZE + x) * 4;
      const baseA = buffer[idx + 3] / 255;
      const a = cov;
      const outA = a + baseA * (1 - a);
      if (outA <= 0) continue;
      buffer[idx] = Math.round((r * a + buffer[idx] * baseA * (1 - a)) / outA);
      buffer[idx + 1] = Math.round((g * a + buffer[idx + 1] * baseA * (1 - a)) / outA);
      buffer[idx + 2] = Math.round((b * a + buffer[idx + 2] * baseA * (1 - a)) / outA);
      buffer[idx + 3] = Math.round(outA * 255);
    }
  }
}

function gradientBuffer() {
  const buf = Buffer.alloc(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    const [r, g, b] = gradAt(y);
    for (let x = 0; x < SIZE; x++) {
      const idx = (y * SIZE + x) * 4;
      buf[idx] = r;
      buf[idx + 1] = g;
      buf[idx + 2] = b;
      buf[idx + 3] = 255;
    }
  }
  return buf;
}

function transparentBuffer() {
  return Buffer.alloc(SIZE * SIZE * 4);
}

const outDir = path.join(__dirname, "..", "assets", "images");
const white = () => [255, 255, 255];
const gradientRingColor = (_x, y) => gradAt(y);

const iconPng = gradientBuffer();
drawRing(iconPng, SIZE / 2, SIZE / 2, 235, 130, white);
fs.writeFileSync(path.join(outDir, "icon.png"), encodePng(iconPng));

const bgPng = gradientBuffer();
fs.writeFileSync(path.join(outDir, "android-icon-background.png"), encodePng(bgPng));

const fgPng = transparentBuffer();
drawRing(fgPng, SIZE / 2, SIZE / 2, 200, 115, white);
fs.writeFileSync(path.join(outDir, "android-icon-foreground.png"), encodePng(fgPng));

const monoPng = transparentBuffer();
drawRing(monoPng, SIZE / 2, SIZE / 2, 200, 115, white);
fs.writeFileSync(path.join(outDir, "android-icon-monochrome.png"), encodePng(monoPng));

const splashPng = transparentBuffer();
drawRing(splashPng, SIZE / 2, SIZE / 2, 235, 130, gradientRingColor);
fs.writeFileSync(path.join(outDir, "splash-icon.png"), encodePng(splashPng));

console.log("Ícones gerados em", outDir);