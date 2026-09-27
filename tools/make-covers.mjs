// CrazyGames borítóképek generálása kódból (canvas), a játék saját rajzolójának stílusában.
// Kimenet: covers/cover-landscape-1920x1080.png, cover-portrait-800x1200.png, cover-square-800x800.png
// Használat: node tools/make-covers.mjs   (fej nélküli Chromium rajzol és ment pontos pixelméretben)
// Kell hozzá: npm i -D playwright && npx playwright install chromium
//
// A rajzoló függvények a játék renderelőjének átiratai: renderRing (szegmentált időgyűrű),
// a tárcsa (dial), a hatszöges háttér és a 3D-s kerek gomb – ugyanazokkal a színekkel,
// arányokkal és a Lilita One betűvel.

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'covers');
const FONT = readFileSync(join(here, 'lilita-one-latin-400-normal.woff2')).toString('base64');

const FORMATS = [
  { name: 'landscape', w: 1920, h: 1080 },
  { name: 'portrait', w: 800, h: 1200 },
  { name: 'square', w: 800, h: 800 }
];

// ------------------------------------------------------------------ böngészőben futó rajzoló kód
const PAGE = /* html */ `<!doctype html><html><head><style>
html,body{margin:0;background:#000;overflow:hidden}canvas{display:block}
</style></head><body><canvas id="c"></canvas><script>
// a játék palettája
const c = { bg: '#15151c', red: '#ff3347', green: '#27e36b', neon: '#39ff88', yellow: '#ffd21f',
  white: '#f4f4f8', ink: '#101014', dim: '#9a9ab0' };
const FONT = '"Lilita One", "Arial Black", Impact, sans-serif';
const E = Math.PI * 2;
const SEGMENTS = 32;

const hex = (t) => { const n = parseInt(t.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgba = (t, a) => { const [r, g, b] = hex(t); return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'; };
const mix = (a, b, t) => { const x = hex(a), y = hex(b); return 'rgb(' + x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',') + ')'; };
const darken = (t, k = 0.62) => 'rgb(' + hex(t).map((v) => Math.round(v * k)).join(',') + ')';
const lighten = (t, k) => 'rgb(' + hex(t).map((v) => Math.round(v + (255 - v) * k)).join(',') + ')';
const withAlpha = (col, a) => col.startsWith('#') ? rgba(col, a) : col.replace('rgb(', 'rgba(').replace(')', ',' + a + ')');

// ---- háttér: hatszögrács, zöld körök a tárcsa körül, vignetta (a játék háttér-rajzolója)
function background(ctx, W, H, cx, cy, inner, s) {
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(120,150,255,0.07)';
  ctx.lineWidth = 2 * s;
  const r = 46 * s, h = r * Math.sqrt(3);
  for (let f = -1; f * h * 0.5 < H + h; f++) {
    for (let y = -1; y * r * 1.5 < W + r * 2; y++) {
      const X = y * r * 1.5, Y = f * h + (y % 2 ? h / 2 : 0);
      ctx.beginPath();
      for (let z = 0; z < 6; z++) {
        const a = (z / 6) * E;
        const px = X + Math.cos(a) * r * 0.92, py = Y + Math.sin(a) * r * 0.92;
        z === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.stroke();
    }
  }
  ctx.strokeStyle = 'rgba(57,255,136,0.05)';
  ctx.lineWidth = 3 * s;
  for (let f = inner + 40 * s; f < Math.max(W, H) * 1.2; f += 70 * s) { ctx.beginPath(); ctx.arc(cx, cy, f, 0, E); ctx.stroke(); }
  // piros "vészfény" a sarkokból: feszültség
  for (const [x, y, a] of [[0, 0, 0.16], [W, H, 0.12]]) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(W, H) * 0.7);
    g.addColorStop(0, rgba(c.red, a)); g.addColorStop(1, rgba(c.red, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  const v = ctx.createRadialGradient(cx, cy, inner * 0.9, cx, cy, Math.max(W, H) * 0.8);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.62)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  const gl = ctx.createRadialGradient(cx, cy, inner * 0.8, cx, cy, inner * 1.6);
  gl.addColorStop(0, 'rgba(57,255,136,0.07)'); gl.addColorStop(1, 'rgba(57,255,136,0)');
  ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);
}

// ---- tárcsa (a játék dial-rajzolója; játék-egységekben, a hívó skáláz)
function dial(ctx, R, inner) {
  const a = ctx.createRadialGradient(0, 0, inner, 0, 0, R);
  a.addColorStop(0, '#07080b'); a.addColorStop(0.5, '#161922'); a.addColorStop(1, '#0a0b0f');
  ctx.fillStyle = a;
  ctx.beginPath(); ctx.arc(0, 0, R, 0, E); ctx.arc(0, 0, inner, 0, E, true); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, 0, R - 1, 0, E); ctx.stroke();
  const l = ctx.createRadialGradient(-inner * 0.25, -inner * 0.3, inner * 0.1, 0, 0, inner);
  l.addColorStop(0, 'rgba(38,43,56,0.80)'); l.addColorStop(0.7, 'rgba(18,21,28,0.86)'); l.addColorStop(1, 'rgba(8,9,12,0.94)');
  ctx.fillStyle = l; ctx.beginPath(); ctx.arc(0, 0, inner, 0, E); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, inner, 0, E); ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.035)';
  for (let h = -inner; h <= inner; h += 12) for (let u = -inner; u <= inner; u += 12) ctx.fillRect(u + ((h / 12) % 2 ? 6 : 0), h, 1.4, 1.4);
  ctx.strokeStyle = 'rgba(160,190,255,0.05)'; ctx.lineWidth = 1;
  for (let h = 30; h < inner; h += 30) { ctx.beginPath(); ctx.arc(0, 0, h, 0, E); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(-inner, 0); ctx.lineTo(inner, 0); ctx.moveTo(0, -inner); ctx.lineTo(0, inner); ctx.stroke();
  const sh = ctx.createLinearGradient(-inner, -inner, inner * 0.2, inner * 0.2);
  sh.addColorStop(0, 'rgba(255,255,255,0.05)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)');
  ctx.fillStyle = sh; ctx.fillRect(-inner, -inner, 2 * inner, 2 * inner);
  ctx.restore();
  for (let h = 0; h < 72; h++) {
    const u = (h / 72) * E, major = h % 6 === 0;
    ctx.strokeStyle = major ? 'rgba(200,220,255,0.22)' : 'rgba(200,220,255,0.10)';
    ctx.lineWidth = major ? 2 : 1;
    const f = inner - (major ? 10 : 5);
    ctx.beginPath(); ctx.moveTo(Math.cos(u) * f, Math.sin(u) * f); ctx.lineTo(Math.cos(u) * (inner - 1), Math.sin(u) * (inner - 1)); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(200,220,255,0.12)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, 0, inner, 0, E); ctx.stroke();
}

// ---- renderRing: szegmentált időgyűrű. A fogyó vég szegmensei pirosba váltanak és "lüktetnek".
function arcSeg(ctx, r, a0, a1) { ctx.beginPath(); a1 >= a0 ? ctx.arc(0, 0, r, a0, a1) : ctx.arc(0, 0, r, a1, a0); ctx.stroke(); }
const segAngle = (i, step) => -Math.PI / 2 + i * step;

function renderRing(ctx, R, progress, base) {
  const s = SEGMENTS, rr = R - 17, o = 12, step = E / s, gap = Math.min(0.06, step * 0.22);
  const fill = progress * s;
  const lit = Math.ceil(fill);
  const hot = 6; // ennyi szegmens a fogyó végen vált át pirosba (zöld → sárga → narancs → piros)
  const HOT = [c.red, c.red, c.red, '#ff8a1f', c.yellow, mix(c.yellow, base, 0.5)];
  const colorOf = (i) => {
    const d = lit - 1 - i; // 0 = a legutolsó (legvészesebb) szegmens
    return d >= hot ? base : HOT[d];
  };
  const pulseOf = (i) => { const d = lit - 1 - i; return d >= hot ? 1 : d < 3 ? 1.9 - d * 0.15 : 1.2; };
  ctx.save(); ctx.lineCap = 'butt';
  // üres sín
  ctx.lineWidth = o; ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  for (let i = 0; i < s; i++) { const a = segAngle(i, step) + gap / 2; arcSeg(ctx, rr, a, a + step - gap); }
  // 3 menet: glow, mag, belső fényél (mint a játékban), erősebb neonnal a borítóhoz
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < lit; i++) {
      const amt = Math.max(0, Math.min(1, fill - i));
      const col = colorOf(i), S = pulseOf(i);
      const a = segAngle(i, step) + gap / 2, len = (step - gap) * amt;
      if (pass === 0) {
        ctx.lineWidth = o + 14 * S; ctx.strokeStyle = withAlpha(col, Math.min(0.55, 0.22 * S));
        ctx.shadowColor = col; ctx.shadowBlur = 26 * S;
        arcSeg(ctx, rr, a, a + len);
      } else if (pass === 1) {
        ctx.shadowColor = col; ctx.shadowBlur = 14 * S;
        ctx.lineWidth = o; ctx.strokeStyle = col; arcSeg(ctx, rr, a, a + len);
      } else {
        ctx.shadowBlur = 0;
        ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(255,255,255,' + Math.min(0.9, 0.45 * S) + ')';
        arcSeg(ctx, rr - o / 2 + 2, a, a + len);
      }
    }
  }
  ctx.shadowBlur = 0;
  // a fogyó vég fénypontja
  const tip = segAngle(0, step) + gap / 2 + progress * E;
  ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.shadowColor = c.red; ctx.shadowBlur = 18;
  ctx.beginPath(); ctx.arc(Math.cos(tip) * rr, Math.sin(tip) * rr, 5, 0, E); ctx.fill();
  ctx.restore();
}

// ---- szöveg a játék stílusában: sötét körvonal + kitöltés (drawLines)
function lines(ctx, textLines, x, y, size, color, { stroke = true, glowCol = null, glow = 0, spacing = 1.05 } = {}) {
  ctx.font = size + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const lh = size * spacing, y0 = y - ((textLines.length - 1) * lh) / 2;
  textLines.forEach((t, i) => {
    const yy = y0 + i * lh + size * 0.04;
    if (stroke) { ctx.lineWidth = Math.max(3, size * 0.14); ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(8,8,12,0.85)'; ctx.strokeText(t, x, yy); }
    if (glow) { ctx.shadowColor = glowCol || color; ctx.shadowBlur = glow; }
    ctx.fillStyle = color; ctx.fillText(t, x, yy);
    ctx.shadowBlur = 0;
  });
}
const fitSize = (ctx, textLines, size, maxW) => {
  ctx.font = size + 'px ' + FONT;
  const w = Math.max(...textLines.map((t) => ctx.measureText(t).width));
  return w > maxW ? Math.floor((size * maxW) / w) : size;
};

// ---- 3D kerek gomb (drawRound) "DON'T PRESS" felirattal, remegés-jelekkel
function button(ctx, r, color, label) {
  const h = Math.max(4, r * 0.13);
  const gl = ctx.createRadialGradient(0, 0, r * 0.8, 0, 0, r * 1.8);
  gl.addColorStop(0, rgba(color, 0.45)); gl.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, r * 1.8, 0, E); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(0, h + r * 0.12, r * 1.02, r * 0.92, 0, 0, E); ctx.fill();
  ctx.strokeStyle = rgba(color, 0.45); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, h * 0.5, r + 6, 0, E); ctx.stroke();
  ctx.fillStyle = darken(color, 0.55); ctx.beginPath(); ctx.arc(0, h, r, 0, E); ctx.fill();
  const f = ctx.createRadialGradient(-r * 0.35, -r * 0.45, r * 0.1, 0, 0, r);
  f.addColorStop(0, lighten(color, 0.35)); f.addColorStop(0.55, color); f.addColorStop(1, darken(color, 0.82));
  ctx.fillStyle = f; ctx.beginPath(); ctx.arc(0, 0, r, 0, E); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.ellipse(-r * 0.2, -r * 0.52, r * 0.5, r * 0.2, -0.35, 0, E); ctx.fill();
  const tl = label.split('\\n');
  lines(ctx, tl, 0, 0, fitSize(ctx, tl, r * 0.36, r * 1.55), c.white);
  // remegés: rövid ívek a gomb két oldalán
  ctx.strokeStyle = rgba(c.white, 0.55); ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      ctx.lineWidth = 4 - k;
      const rad = r * (1.2 + k * 0.14), mid = side < 0 ? Math.PI : 0;
      ctx.beginPath(); ctx.arc(0, h * 0.5, rad, mid - 0.32 + k * 0.05, mid + 0.32 - k * 0.05); ctx.stroke();
    }
  }
}

// ---- a teljes tárcsa-jelenet: dial + gyűrű + gomb + a csapda szövegei
function dialScene(ctx, cx, cy, R) {
  const G = 270, k = R / G, inner = G - 34; // a játék arányai: inner = R - 34
  ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k);
  dial(ctx, G, inner);
  renderRing(ctx, G, 0.66, c.neon);
  lines(ctx, ['Whatever you do...'], 0, -inner * 0.64, 23, c.dim);
  ctx.save(); ctx.translate(0, -6); ctx.rotate(-0.035); button(ctx, 104, c.red, "DON'T\\nPRESS"); ctx.restore();
  lines(ctx, ["...don't press it."], 0, inner * 0.66, 23, c.white);
  ctx.restore();
}

// ---- cím: nagy piros Lilita One, 3D-s alsó él, sötét körvonal, neon glow, enyhe "remegés"
function title(ctx, textLines, x, y, size, rot = -0.03) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  const lh = size * 0.98, y0 = -((textLines.length - 1) * lh) / 2;
  ctx.font = size + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  textLines.forEach((t, i) => {
    const yy = y0 + i * lh;
    // mély árnyék és 3D él
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillText(t, size * 0.02, yy + size * 0.11);
    ctx.lineWidth = size * 0.14; ctx.lineJoin = 'round'; ctx.strokeStyle = '#08080c'; ctx.strokeText(t, 0, yy + size * 0.06);
    ctx.fillStyle = darken(c.red, 0.5); ctx.fillText(t, 0, yy + size * 0.06);
    ctx.strokeStyle = 'rgba(8,8,12,0.9)'; ctx.strokeText(t, 0, yy);
    ctx.shadowColor = c.red; ctx.shadowBlur = size * 0.35; ctx.fillStyle = c.red; ctx.fillText(t, 0, yy);
    ctx.shadowBlur = 0;
    const g = ctx.createLinearGradient(0, yy - size * 0.45, 0, yy + size * 0.45);
    g.addColorStop(0, lighten(c.red, 0.3)); g.addColorStop(0.55, c.red); g.addColorStop(1, darken(c.red, 0.85));
    ctx.fillStyle = g; ctx.fillText(t, 0, yy);
  });
  ctx.restore();
}

const LAYOUTS = {
  // fekvő: cím balra, tárcsa jobbra, bőséges biztonsági margó minden szélen
  landscape(ctx, W, H) {
    const cx = 1300, cy = 548, R = 350;
    background(ctx, W, H, cx, cy, (R - 34 * R / 270), 1.25);
    dialScene(ctx, cx, cy, R);
    const size = fitSize(ctx, ['BUTTON'], 205, 640);
    title(ctx, ['PANIC', 'BUTTON'], 570, 470, size);
    lines(ctx, ['One button. 43 traps.', 'It learns how you play.'], 570, 745, 42, c.dim, { spacing: 1.25 });
  },
  // álló: cím két sorban felül, nagy tárcsa középen-lent
  portrait(ctx, W, H) {
    const cx = 400, cy = 745, R = 330;
    background(ctx, W, H, cx, cy, (R - 34 * R / 270), 0.9);
    title(ctx, ['PANIC', 'BUTTON'], 400, 245, fitSize(ctx, ['BUTTON'], 160, 560));
    dialScene(ctx, cx, cy, R);
    lines(ctx, ['One button. 43 traps.'], 400, 1128, 32, c.dim);
  },
  // négyzet: egysoros cím felül, a tárcsa tölti ki a teret
  square(ctx, W, H) {
    const cx = 400, cy = 470, R = 290;
    background(ctx, W, H, cx, cy, (R - 34 * R / 270), 0.85);
    dialScene(ctx, cx, cy, R);
    title(ctx, ['PANIC BUTTON'], 400, 102, fitSize(ctx, ['PANIC BUTTON'], 110, 640), -0.025);
  }
};

window.render = async (name, W, H, font) => {
  const face = new FontFace('Lilita One', 'url(data:font/woff2;base64,' + font + ')');
  await face.load(); document.fonts.add(face);
  const cv = document.getElementById('c'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  LAYOUTS[name](ctx, W, H);
  return cv.toDataURL('image/png');
};
</script></body></html>`;

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
try {
  for (const f of FORMATS) {
    const page = await browser.newPage({ viewport: { width: f.w, height: f.h }, deviceScaleFactor: 1 });
    await page.setContent(PAGE);
    const url = await page.evaluate(([n, w, h, font]) => window.render(n, w, h, font), [f.name, f.w, f.h, FONT]);
    const file = join(outDir, `cover-${f.name}-${f.w}x${f.h}.png`);
    writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
    console.log('wrote', file);
    await page.close();
  }
} finally {
  await browser.close();
}
