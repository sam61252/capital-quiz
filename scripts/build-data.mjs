// One-time (re-runnable) build step. Run: npm run build
//
// 1. Reads the `world-countries` dataset (mledoze/countries, ODbL).
// 2. Filters to a "recognized" set (UN members + a curated allowlist) >= 206.
// 3. Writes data/countries.json (slim records).
// 4. Copies only the SVG flags it needs from `flag-icons` (MIT) into assets/flags/.
// 5. Generates PWA icons (icons/) with a tiny dependency-free PNG encoder.
// 6. Writes precache-manifest.json for the service worker (full offline cache list).
//
// The shipped app has NO runtime dependencies — everything is static.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = process.cwd();

// ---------------------------------------------------------------------------
// Country selection
// ---------------------------------------------------------------------------

// UN observer states + widely-recognized / commonly-quizzed entities that are
// not UN members but belong in a geography quiz. Ordered most-recognized first.
// (UN members — 193 — are included automatically.) This pushes the total > 206.
const EXTRA_ALLOW = new Set([
  'TW', // Taiwan
  'XK', // Kosovo
  'VA', // Vatican City (Holy See) — UN observer
  'PS', // Palestine — UN observer
  'HK', // Hong Kong
  'MO', // Macau
  'CK', // Cook Islands
  'NU', // Niue
  'EH', // Western Sahara
  'GL', // Greenland
  'FO', // Faroe Islands
  'AW', // Aruba
  'PR', // Puerto Rico
  'BM', // Bermuda
]);

// ---------------------------------------------------------------------------
// Load world-countries (robust across packaging styles)
// ---------------------------------------------------------------------------
async function loadCountries() {
  // Preferred: import the JSON main directly.
  try {
    const mod = await import('world-countries', { with: { type: 'json' } });
    if (Array.isArray(mod.default)) return mod.default;
  } catch {
    /* fall through */
  }
  // Fallback: resolve a JSON file on disk and parse it.
  const candidates = [
    'world-countries/countries.json',
    'world-countries/dist/countries.json',
    'world-countries',
  ];
  for (const c of candidates) {
    try {
      const p = require.resolve(c);
      if (p.endsWith('.json')) {
        return JSON.parse(fs.readFileSync(p, 'utf8'));
      }
    } catch {
      /* try next */
    }
  }
  throw new Error('Could not load the `world-countries` dataset. Did `npm install` run?');
}

function flagsDir() {
  const pkg = require.resolve('flag-icons/package.json');
  return path.join(path.dirname(pkg), 'flags', '4x3');
}

// ---------------------------------------------------------------------------
// Tiny PNG encoder (RGBA, no compression filters) — for the app icons.
// ---------------------------------------------------------------------------
let CRC_TABLE = null;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function u32(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0, 0);
  return b;
}
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  return Buffer.concat([u32(data.length), t, data, u32(crc32(Buffer.concat([t, data])))]);
}
function encodePNG(size, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// A simple, modern "globe" mark on an indigo field. iOS masks the corners to a
// rounded square automatically, so a full-bleed design is fine.
function renderGlobe(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const ACCENT = [79, 70, 229]; // #4f46e5
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.34;
  const t = Math.max(2, size * 0.013); // line thickness
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let r = ACCENT[0];
      let g = ACCENT[1];
      let b = ACCENT[2];
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.hypot(dx, dy);
      if (dist <= R) {
        r = g = b = 255; // white globe
        const ring = R - dist < t; // outline
        const meridianMid = Math.abs(dx) < t; // central meridian
        const meridianSide = Math.abs(Math.abs(dx) - R * 0.5) < t * 0.9; // side meridians
        const equator = Math.abs(dy) < t; // equator
        const parallels = Math.abs(Math.abs(dy) - R * 0.5) < t * 0.9; // tropics
        if (ring || meridianMid || meridianSide || equator || parallels) {
          r = ACCENT[0];
          g = ACCENT[1];
          b = ACCENT[2];
        }
      }
      rgba[i] = r;
      rgba[i + 1] = g;
      rgba[i + 2] = b;
      rgba[i + 3] = 255;
    }
  }
  return rgba;
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------
function rmDir(p) {
  fs.rmSync(p, { recursive: true, force: true });
}
function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

async function main() {
  const all = await loadCountries();
  console.log(`Loaded ${all.length} entries from world-countries.`);

  const unMembers = all.filter((c) => c.unMember === true).length;
  console.log(`  UN members in source: ${unMembers}`);

  const selected = all
    .filter((c) => c.unMember === true || EXTRA_ALLOW.has(c.cca2))
    .map((c) => ({
      cc: String(c.cca2).toLowerCase(),
      name: c.name?.common ?? c.cca2,
      official: c.name?.official ?? c.name?.common ?? c.cca2,
      capitals: Array.isArray(c.capital) ? c.capital.filter(Boolean) : [],
      region: c.region || '',
      subregion: c.subregion || c.region || '',
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Verify a flag SVG exists for every selected country; copy them.
  const FLAGS_SRC = flagsDir();
  const flagsOut = path.join(ROOT, 'assets', 'flags');
  rmDir(flagsOut);
  ensureDir(flagsOut);

  const kept = [];
  const missingFlags = [];
  for (const c of selected) {
    const src = path.join(FLAGS_SRC, `${c.cc}.svg`);
    if (!fs.existsSync(src)) {
      missingFlags.push(c.cc);
      continue; // skip — never ship a broken flag
    }
    fs.copyFileSync(src, path.join(flagsOut, `${c.cc}.svg`));
    kept.push(c);
  }
  if (missingFlags.length) {
    console.warn(`  WARNING: no flag SVG for: ${missingFlags.join(', ')} (excluded)`);
  }

  const withCapitals = kept.filter((c) => c.capitals.length >= 1);
  console.log(`Selected ${kept.length} countries (${withCapitals.length} have a capital).`);

  // Write dataset.
  ensureDir(path.join(ROOT, 'data'));
  fs.writeFileSync(path.join(ROOT, 'data', 'countries.json'), JSON.stringify(kept));

  // Generate icons.
  const iconsOut = path.join(ROOT, 'icons');
  ensureDir(iconsOut);
  for (const [name, size] of [
    ['apple-touch-icon.png', 180],
    ['icon-192.png', 192],
    ['icon-512.png', 512],
  ]) {
    fs.writeFileSync(path.join(iconsOut, name), encodePNG(size, renderGlobe(size)));
  }
  console.log('Wrote icons: apple-touch-icon.png, icon-192.png, icon-512.png');

  // Write precache manifest for the service worker.
  const precache = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './manifest.webmanifest',
    './data/countries.json',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/apple-touch-icon.png',
    ...kept.map((c) => `./assets/flags/${c.cc}.svg`),
  ];
  fs.writeFileSync(path.join(ROOT, 'precache-manifest.json'), JSON.stringify(precache));
  console.log(`Wrote precache-manifest.json (${precache.length} entries).`);

  // Hard requirement.
  if (kept.length < 206) {
    throw new Error(`Only ${kept.length} countries — need >= 206. Extend EXTRA_ALLOW.`);
  }
  console.log(`\n✅ Build OK — ${kept.length} countries (>= 206).`);
}

main().catch((err) => {
  console.error('\n❌ Build failed:', err.message);
  process.exit(1);
});
