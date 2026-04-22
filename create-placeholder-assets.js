/**
 * create-placeholder-assets.js
 *
 * Generates placeholder PNG files for react-native-bootsplash:
 *   assets/icon.png        — 1024×1024 purple square  (app icon base)
 *   assets/splash-logo.png — 512×512  white square    (logo on purple splash)
 *
 * Uses ONLY Node.js built-in modules (zlib, fs, path) — no npm install needed.
 * Run: node create-placeholder-assets.js
 */

const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

// ── CRC-32 ────────────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++)
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// ── PNG chunk helper ──────────────────────────────────────────────────────────
function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf  = Buffer.allocUnsafe(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcVal  = Buffer.allocUnsafe(4);
  crcVal.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcVal]);
}

// ── Build a solid-colour RGB PNG ──────────────────────────────────────────────
function buildPNG(width, height, r, g, b) {
  // IHDR
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(width,  0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8]  = 8;  // bit depth
  ihdr[9]  = 2;  // colour type: truecolour RGB
  ihdr[10] = 0;  // compression method
  ihdr[11] = 0;  // filter method
  ihdr[12] = 0;  // interlace: none

  // Raw scanlines: filter-byte(0) + width×[R,G,B]
  const rowBytes = 1 + width * 3;
  const raw = Buffer.allocUnsafe(height * rowBytes);
  for (let y = 0; y < height; y++) {
    const base = y * rowBytes;
    raw[base] = 0;                      // filter = None
    for (let x = 0; x < width; x++) {
      raw[base + 1 + x * 3] = r;
      raw[base + 2 + x * 3] = g;
      raw[base + 3 + x * 3] = b;
    }
  }

  const idat = zlib.deflateSync(raw, { level: 1 }); // fast compress

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idat),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Main ──────────────────────────────────────────────────────────────────────
const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

// App icon — 1024×1024 brand purple #7C3AED  (R=124 G=58 B=237)
const iconPath = path.join(assetsDir, 'icon.png');
fs.writeFileSync(iconPath, buildPNG(1024, 1024, 124, 58, 237));
console.log('✅  assets/icon.png        created  (1024×1024 purple)');

// Splash logo — 512×512 white #FFFFFF  (shows on purple splash background)
const logoPath = path.join(assetsDir, 'splash-logo.png');
fs.writeFileSync(logoPath, buildPNG(512, 512, 255, 255, 255));
console.log('✅  assets/splash-logo.png created  (512×512 white)');

console.log('\nNext step:');
console.log('  node generate-assets.js\n');
