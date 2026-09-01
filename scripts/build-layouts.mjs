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
  ['rubikon-50', 'number', '50х50х50 - рубикон.svg'],
  ['rubikon-60', 'number', '60х60х60 - рубикон.svg'],
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
      const mm = /matrix\(([^)]+)\)/.exec(transformAttr);
      if (mm) {
        const m = parseMatrix(mm[1]);
        tx = m.e;
        ty = m.f;
        rotation = m.rotation;
        c = m.c;
        d = m.d;
      }
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
          arcData: computeArcPath(vbW, vbH, 250),
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
      const lines = [];
      tspans.forEach((tspan, i) => {
        lines.push(tspan.text);
        if (i === 0) {
          firstX = parseFloat(tspan.getAttribute('x') || '0');
          Object.assign(style, resolveTextStyle(tspan, styleMap));
        }
      });
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

    if (x / vbW < -0.4 || x / vbW > 1.6 || y / vbH < -0.4 || y / vbH > 1.6) continue;

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
    const mm = transformAttr && /matrix\(([^)]+)\)/.exec(transformAttr);
    if (!mm) continue;
    const m = parseMatrix(mm[1]);
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

const results = {};
for (const [productId, faceId, filename] of FILES) {
  console.log('Processing', filename);
  const face = processFile(productId, faceId, filename);
  results[productId] = results[productId] || [];
  results[productId].push(face);
}

writeFileSync(path.join(ROOT, 'scripts', 'extracted.json'), JSON.stringify(results, null, 2), 'utf-8');

const tsOut = `// AUTO-GENERATED by scripts/build-layouts.mjs — do not edit by hand.
import type { FaceDef } from './layout-types';

export const GENERATED_FACES: Record<string, FaceDef[]> = ${JSON.stringify(results, null, 2)};
`;
writeFileSync(path.join(ROOT, 'src', 'generated-faces.ts'), tsOut, 'utf-8');
console.log('Done.');
