import { parse } from 'node-html-parser';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = 'C:\\Users\\wwarm\\Downloads\\мекеты мерч стандарт svg\\Для Сережи мекеты мерч стандарт';
const ASSET_DIR = path.join(ROOT, 'public', 'layers');
rmSync(ASSET_DIR, { recursive: true, force: true });
mkdirSync(ASSET_DIR, { recursive: true });

const PT_PER_MM = 2.8346456693;

// productId, faceId, filename
const FILES = [
  ['azau', 'main', '50х80 - Азау.svg'],
  ['onix', 'main', '59мм -Оникс_счёт.svg'],
  ['amfora', 'front', '60х130 - Амфора.svg'],
  ['arktika', 'main', '60х90_Арктика-new.svg'],
  ['naklejka-white', 'main', '80х80- наклейка_белая.svg'],
  ['naklejka-black', 'main', '80х80- наклейка.svg'],
  ['karelia', 'main', '84х54- Карелия_счёт.svg'],
];

function parseMatrix(str) {
  const [a, b, c, d, e, f] = str.trim().split(/[ ,]+/).map(Number);
  const rotation = (Math.atan2(b, a) * 180) / Math.PI;
  return { a, b, c, d, e, f, rotation };
}

// Illustrator emits either `matrix(a b c d e f)` or `translate(tx ty) scale(sx sy)` — handle both.
function parseTransform(str) {
  if (!str) return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, rotation: 0 };
  const mm = /matrix\(([^)]+)\)/.exec(str);
  if (mm) return parseMatrix(mm[1]);
  let a = 1;
  let d = 1;
  let e = 0;
  let f = 0;
  const t = /translate\(([^)]+)\)/.exec(str);
  if (t) {
    const parts = t[1].trim().split(/[ ,]+/).map(Number);
    e = parts[0] ?? 0;
    f = parts[1] ?? 0;
  }
  const s = /scale\(([^)]+)\)/.exec(str);
  if (s) {
    const parts = s[1].trim().split(/[ ,]+/).map(Number);
    a = parts[0] ?? 1;
    d = parts.length > 1 ? parts[1] : parts[0];
  }
  return { a, b: 0, c: 0, d, e, f, rotation: 0 };
}

function buildStyleMap(styleText) {
  const map = {};
  const re = /\.([\w-]+)\s*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(styleText))) {
    const [, cls, body] = m;
    const props = {};
    const fill = /(?:^|[;\s])fill:\s*(#[0-9a-fA-F]{3,6}|none)/.exec(body);
    const family = /font-family:\s*'?([^;']+)'?/.exec(body);
    const size = /font-size:\s*([\d.]+)px/.exec(body);
    if (fill) props.fill = fill[1];
    if (family) props.fontFamily = family[1].trim();
    if (size) props.fontSize = parseFloat(size[1]);
    map[cls] = props;
  }
  return map;
}

function resolveTextStyle(el, styleMap) {
  const props = {};
  const classAttr = el.getAttribute('class');
  if (classAttr) {
    for (const cls of classAttr.split(/\s+/)) {
      if (styleMap[cls]) Object.assign(props, styleMap[cls]);
    }
  }
  const styleAttr = el.getAttribute('style');
  if (styleAttr) {
    const family = /font-family:\s*'?([^;']+)'?/.exec(styleAttr);
    const size = /font-size:\s*([\d.]+)px/.exec(styleAttr);
    const fill = /fill:\s*(#[0-9a-fA-F]{3,6})/.exec(styleAttr);
    if (family) props.fontFamily = family[1].trim();
    if (size) props.fontSize = parseFloat(size[1]);
    if (fill) props.fill = fill[1];
  }
  return props;
}

const isBold = (f) => !!f && /medium|bold|black|semibold/i.test(f);

function computeArcPath(w, h, sweepDeg) {
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.42;
  const half = sweepDeg / 2;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const point = (deg) => ({ x: cx + r * Math.sin(toRad(deg)), y: cy - r * Math.cos(toRad(deg)) });
  const p1 = point(-half);
  const p2 = point(half);
  const largeArc = sweepDeg > 180 ? 1 : 0;
  return `M ${p1.x},${p1.y} A ${r},${r} 0 ${largeArc},1 ${p2.x},${p2.y}`;
}

let uid = 0;
const nextId = (p) => `${p}${++uid}`;

const LABELS = {
  тёмный_слой: 'Фон',
  Основной_фон: 'Основа',
  Не_печатаемый_слой: 'Диск (градиент)',
  crop: 'Рамка',
  Слой_1: 'Графика 1',
  Слой_2: 'Графика 2',
};

function niceLabel(id, fallback) {
  if (!id) return fallback;
  return LABELS[id] || id.replace(/_/g, ' ');
}

function processFile(productId, faceId, filename) {
  const filePath = path.join(SRC_DIR, filename);
  const raw = readFileSync(filePath, 'utf-8');
  const root = parse(raw, { lowerCaseTagName: true, comment: false });
  const svgEl = root.querySelector('svg');
  const [, , vbW, vbH] = svgEl.getAttribute('viewbox').trim().split(/\s+/).map(Number);

  const styleEl = svgEl.querySelector('style');
  const styleMap = styleEl ? buildStyleMap(styleEl.text) : {};
  const styleBlockHtml = styleEl ? styleEl.outerHTML : '';
  const defsEls = svgEl.querySelectorAll('defs');
  const defsHtml = defsEls.map((d) => d.outerHTML).join('\n');

  const layers = [];

  // ---------- text ----------
  for (const textEl of svgEl.querySelectorAll('text')) {
    const transformAttr = textEl.getAttribute('transform');
    let tx = 0;
    let ty = 0;
    let rotation = 0;
    let c = 0;
    let d = 1;
    if (transformAttr) {
      const m = parseTransform(transformAttr);
      tx = m.e;
      ty = m.f;
      rotation = m.rotation;
      c = m.c;
      d = m.d;
    }

    const textPathEl = textEl.querySelector('textpath');
    if (textPathEl) {
      const tspan = textPathEl.querySelector('tspan');
      const content = (tspan ? tspan.text : textPathEl.text).trim();
      const style = tspan ? resolveTextStyle(tspan, styleMap) : {};
      if (content) {
        layers.push({
          kind: 'text',
          id: nextId('arc'),
          text: content,
          xf: 0,
          yf: 0,
          wf: 1,
          fontSizeF: (style.fontSize || 12) / vbW,
          align: 'center',
          fill: style.fill || '#000000',
          fontStyle: isBold(style.fontFamily) ? 'bold' : 'normal',
          rotation: 0,
          arc: { sweepDeg: 250 },
        });
      }
      textEl.remove();
      continue;
    }

    const tspans = textEl.querySelectorAll('tspan');
    let content = '';
    const style = resolveTextStyle(textEl, styleMap);
    let firstX = 0;
    if (tspans.length > 0) {
      // group consecutive tspans (plus any bare leading text) by their y — multiple tspans can
      // share one visual line (kerning/style spans), only a new y starts a new line
      const lines = [];
      let currentY = null;
      let firstTspanSeen = false;
      for (const child of textEl.childNodes) {
        if (child.nodeType === 3 /* text node */) {
          const t = child.rawText ?? child.text ?? '';
          if (t.trim()) {
            if (lines.length === 0) lines.push('');
            lines[lines.length - 1] += t;
          }
          continue;
        }
        if (!child.tagName || child.tagName.toLowerCase() !== 'tspan') continue;
        const y = child.getAttribute('y');
        if (!firstTspanSeen) {
          // if bare text already started line 1, it began at x=0 (implicit); otherwise this
          // tspan IS line 1's start, so its own x is the true line-start offset
          firstX = lines.length === 0 ? parseFloat(child.getAttribute('x') || '0') : 0;
          Object.assign(style, resolveTextStyle(child, styleMap));
          firstTspanSeen = true;
          if (lines.length > 0 && y === '0') {
            // this tspan continues the bare leading-text line rather than starting a new one
            currentY = y;
            lines[lines.length - 1] += child.text;
            continue;
          }
        }
        if (y !== currentY || lines.length === 0) {
          lines.push('');
          currentY = y;
        }
        lines[lines.length - 1] += child.text;
      }
      content = lines.join('\n');
    } else {
      content = textEl.text.trim();
    }
    content = content.trim();
    textEl.remove();
    if (!content) continue;

    const fontSize = style.fontSize || 10;
    const offset = fontSize * 0.78;
    const x = tx + firstX - c * offset;
    const y = ty - d * offset;

    if (x / vbW < -0.08 || x / vbW > 1.08 || y / vbH < -0.08 || y / vbH > 1.08) continue;

    layers.push({
      kind: 'text',
      id: nextId('t'),
      text: content,
      xf: x / vbW,
      yf: y / vbH,
      wf: 3,
      fontSizeF: fontSize / vbW,
      align: 'left',
      fill: style.fill || '#000000',
      fontStyle: isBold(style.fontFamily) ? 'bold' : 'normal',
      rotation,
    });
  }

  // ---------- QR (opaque raster image, inside canvas bounds) ----------
  let qrTaken = false;
  for (const img of svgEl.querySelectorAll('image')) {
    if (qrTaken) break;
    const styleAttr = img.getAttribute('style') || '';
    const opacityMatch = /opacity:\s*([\d.]+)/.exec(styleAttr);
    const opacity = opacityMatch ? parseFloat(opacityMatch[1]) : 1;
    if (opacity < 0.9) continue;
    const transformAttr = img.getAttribute('transform');
    if (!transformAttr) continue;
    const m = parseTransform(transformAttr);
    const w0 = parseFloat(img.getAttribute('width'));
    const h0 = parseFloat(img.getAttribute('height'));
    const rw = w0 * m.a;
    const rh = h0 * m.d;
    const x = m.e;
    const y = m.f;
    if (x < -5 || y < -5 || x + rw > vbW + 5 || y + rh > vbH + 5) continue;

    const b64 = img.getAttribute('xlink:href').replace(/\s+/g, '');
    const assetPath = `/layers/${productId}-${faceId}-qr.png`;
    writeFileSync(path.join(ROOT, 'public', assetPath), Buffer.from(b64.replace(/^data:image\/png;base64,/, ''), 'base64'));
    layers.push({
      kind: 'image',
      id: nextId('qr'),
      label: 'QR-код',
      xf: x / vbW,
      yf: y / vbH,
      wf: rw / vbW,
      hf: rh / vbH,
      defaultSrc: assetPath,
      opacity: 1,
    });
    img.remove();
    qrTaken = true;
  }

  // ---------- everything else left over = decorative layers, one per direct child ----------
  let decoIndex = 0;
  const decorative = [];
  for (const child of [...svgEl.childNodes]) {
    if (!child.tagName) continue; // text nodes/whitespace
    const tag = child.tagName.toLowerCase();
    if (tag === 'style' || tag === 'defs') continue;
    decoIndex += 1;
    const id = child.getAttribute && child.getAttribute('id');
    const label = niceLabel(id, `Графика ${decoIndex}`);

    // capture opacity of decorative raster images (e.g. faint ring texture)
    let opacity = 1;
    if (tag === 'image') {
      const styleAttr = child.getAttribute('style') || '';
      const om = /opacity:\s*([\d.]+)/.exec(styleAttr);
      if (om) opacity = parseFloat(om[1]);
    } else if (child.querySelectorAll) {
      for (const nestedImg of child.querySelectorAll('image')) {
        const om = /opacity:\s*([\d.]+)/.exec(nestedImg.getAttribute('style') || '');
        if (om) {
          opacity = parseFloat(om[1]);
          break;
        }
      }
    }

    const snippet = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${vbW} ${vbH}">${styleBlockHtml}${defsHtml}${child.outerHTML}</svg>`;
    const fileName = `${productId}-${faceId}-deco${decoIndex}.svg`;
    writeFileSync(path.join(ASSET_DIR, fileName), snippet, 'utf-8');

    decorative.push({
      kind: 'image',
      id: nextId('deco'),
      label,
      xf: 0,
      yf: 0,
      wf: 1,
      hf: 1,
      defaultSrc: `/layers/${fileName}`,
      opacity,
      decorative: true,
    });
  }

  return {
    id: faceId,
    widthPx: vbW,
    heightPx: vbH,
    widthMm: Math.round((vbW / PT_PER_MM) * 10) / 10,
    heightMm: Math.round((vbH / PT_PER_MM) * 10) / 10,
    layers: [...decorative, ...layers],
  };
}

// redraw the stickers' "rings" print effect (the source's own version is a near-white radial
// gradient centered on the QR that's essentially invisible once rendered) as a visible layer.
function writeRings(fileName, stroke, opacityStart, opacityEnd) {
  const cx = 170.32;
  const cy = 153.75;
  const count = 9;
  const rMin = 28;
  const rMax = 120;
  let circles = '';
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const r = rMin + t * (rMax - rMin);
    const op = opacityStart + t * (opacityEnd - opacityStart);
    circles += `<circle cx="${cx}" cy="${cy}" r="${r.toFixed(2)}" fill="none" stroke="${stroke}" stroke-width="0.8" opacity="${op.toFixed(2)}"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 226.77 226.77">${circles}</svg>`;
  writeFileSync(path.join(ASSET_DIR, fileName), svg, 'utf-8');
}
writeRings('rings-light.svg', '#a8a8a8', 0.55, 0.05);
writeRings('rings-dark.svg', '#b0b0b0', 0.75, 0.1);

const results = {};
for (const [productId, faceId, filename] of FILES) {
  console.log('Processing', filename);
  const face = processFile(productId, faceId, filename);
  results[productId] = results[productId] || [];
  results[productId].push(face);
}

// Rubikon cube nets — separately-exported per-artboard SVGs, one per physical face, arranged
// as a cross so the whole net prints/exports as a single sheet.
function processCubeNet(productId, files, colMap, centeredIds) {
  const faces = files.map(([faceId, row, filename]) => {
    console.log('Processing', filename);
    const face = processFile(productId, faceId, filename);
    face.gridRow = row;
    face.gridCol = colMap[faceId];
    // these faces sit edge-to-edge in a grid, unlike standalone products — cap text width so
    // it wraps inside its own cell instead of overlapping the neighboring face
    face.layers = face.layers.map((l) => (l.kind === 'text' && l.wf > 0.85 ? { ...l, wf: 0.85 } : l));
    // multi-line titles had each line individually re-centered in the source (per-line x
    // corrections for centering) — our extractor only reads line 1's start, so it renders
    // left-aligned and drifts right of the true (centered) look; redo it as a centered box
    if (centeredIds.includes(faceId)) {
      face.layers = face.layers.map((l) =>
        l.kind === 'text' ? { ...l, xf: 0.075, wf: 0.85, align: 'center' } : l,
      );
    }
    return face;
  });
  results[productId] = faces;
}

processCubeNet(
  'rubikon-50',
  [
    ['logo', 0, '50х50х50 - рубикон_Монтажная область 1 копия 16.svg'], // top: logo only
    ['title', 1, '50х50х50 - рубикон_Монтажная область 1 копия 12.svg'], // left: "Меню..."
    ['qr', 1, '50х50х50 - рубикон_Монтажная область 1 копия 13.svg'], // center: QR + logo
    ['title2', 1, '50х50х50 - рубикон_Монтажная область 1 копия 14.svg'], // right: "Меню..." dup
    ['qr2', 1, '50х50х50 - рубикон_Монтажная область 1 копия 15.svg'], // far right: QR + logo dup
    ['number', 2, '50х50х50 - рубикон_Монтажная область 1 копия 17.svg'], // bottom: 01/1234567
  ],
  { logo: 1, title: 0, qr: 1, title2: 2, qr2: 3, number: 1 },
  ['title', 'title2'],
);

processCubeNet(
  'rubikon-60',
  [
    ['logo', 0, '60х60х60 - рубикон_Монтажная область 1 копия 16.svg'], // top: logo only
    ['title', 1, '60х60х60 - рубикон_Монтажная область 1 копия 12.svg'], // left: "Оплата заказа..."
    ['qr', 1, '60х60х60 - рубикон_Монтажная область 1 копия 13.svg'], // QR + logo
    ['tagline', 1, '60х60х60 - рубикон_Монтажная область 1 копия 14.svg'], // "Сканируй. Плати..."
    ['qr2', 1, '60х60х60 - рубикон_Монтажная область 1 копия 15.svg'], // QR + logo dup
    ['number', 2, '60х60х60 - рубикон_Монтажная область 1 копия 17.svg'], // bottom: 01/1234567
  ],
  { logo: 1, title: 0, qr: 1, tagline: 2, qr2: 3, number: 1 },
  ['title', 'tagline'],
);

writeFileSync(path.join(ROOT, 'scripts', 'extracted.json'), JSON.stringify(results, null, 2), 'utf-8');

const tsOut = `// AUTO-GENERATED by scripts/build-layouts.mjs — do not edit by hand.
import type { FaceDef } from './layout-types';

export const GENERATED_FACES: Record<string, FaceDef[]> = ${JSON.stringify(results, null, 2)};
`;
writeFileSync(path.join(ROOT, 'src', 'generated-faces.ts'), tsOut, 'utf-8');
console.log('Done.');
