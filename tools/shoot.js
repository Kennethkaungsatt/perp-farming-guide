/**
 * Visual smoke test.
 * Takes headless-Chrome screenshots of the site and prints a low-res ASCII
 * rendering of each, so layout/visibility problems are obvious without a
 * human eye. Also reports how "non-background" pixels each shot contains.
 *
 *   node tools/shoot.js
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

let sharp;
try {
  sharp = require('sharp');
} catch {
  console.error('This optional dev tool needs sharp. Run:\n\n  npm i --no-save sharp\n');
  process.exit(1);
}

const CHROME = '/Applications/Google Chrome 2.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:4173';
const OUT = '/tmp/shots';

const ALL = [
  { name: 'home-desktop', url: `${BASE}/`, w: 1440, h: 900 },
  { name: 'list-desktop', url: `${BASE}/perp-dex-list`, w: 1440, h: 900 },
  { name: 'points-desktop', url: `${BASE}/points-sheet`, w: 1440, h: 900 },
  { name: 'home-mobile', url: `${BASE}/`, w: 390, h: 844 },
  { name: 'list-mobile', url: `${BASE}/perp-dex-list`, w: 390, h: 844 },
  { name: 'points-mobile', url: `${BASE}/points-sheet`, w: 390, h: 844 },
];

const filter = process.argv[2];
const TARGETS = filter ? ALL.filter((t) => t.name.includes(filter)) : ALL;

function shoot({ name, url, w, h }) {
  return new Promise((resolve) => {
    const file = path.join(OUT, `${name}.png`);
    if (fs.existsSync(file)) fs.unlinkSync(file);
    const args = [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--no-first-run',
      '--no-default-browser-check',
      '--run-all-compositor-stages-before-draw',
      '--force-color-profile=srgb',
      `--window-size=${w},${h}`,
      `--user-data-dir=${OUT}/profile-${name}`,
      '--virtual-time-budget=6000',
      `--screenshot=${file}`,
      url,
    ];
    const proc = spawn(CHROME, args, { stdio: 'ignore' });
    const started = Date.now();
    const tick = setInterval(() => {
      if (fs.existsSync(file)) {
        // give chrome a moment to finish writing
        setTimeout(() => {
          clearInterval(tick);
          try { proc.kill('SIGKILL'); } catch {}
          resolve(file);
        }, 700);
      } else if (Date.now() - started > 25000) {
        clearInterval(tick);
        try { proc.kill('SIGKILL'); } catch {}
        resolve(null);
      }
    }, 300);
  });
}

const RAMP = ' .:-=+*#%@';

async function ascii(file, cols = 96) {
  const img = sharp(file);
  const meta = await img.metadata();
  const rows = Math.max(1, Math.round((cols * meta.height) / meta.width / 2.1));
  const { data, info } = await img
    .greyscale()
    .resize(cols, rows, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  // measure how much of the frame is NOT background (bg is near-black)
  let lit = 0;
  for (let i = 0; i < data.length; i++) if (data[i] > 24) lit++;

  const lines = [];
  for (let y = 0; y < info.height; y++) {
    let line = '';
    for (let x = 0; x < info.width; x++) {
      const v = data[y * info.width + x] / 255;
      line += RAMP[Math.min(RAMP.length - 1, Math.floor(v * RAMP.length * 1.6))];
    }
    lines.push(line);
  }
  return { art: lines.join('\n'), litPct: ((lit / data.length) * 100).toFixed(1), size: `${meta.width}x${meta.height}` };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const t of TARGETS) {
    const file = await shoot(t);
    if (!file) {
      console.log(`\n=== ${t.name}: SCREENSHOT FAILED ===`);
      continue;
    }
    const { art, litPct, size } = await ascii(file);
    console.log(`\n=== ${t.name} (${size}, ${litPct}% lit) ===`);
    console.log(art);
  }
  process.exit(0);
})();
