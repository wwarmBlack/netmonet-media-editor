import type { FaceDef, ProductDef, LayerSpec } from './layout-types';
import { GENERATED_FACES } from './generated-faces';

const ink = '#1c1c1c';

function text(partial: Omit<Extract<LayerSpec, { kind: 'text' }>, 'kind'>): LayerSpec {
  return { kind: 'text', ...partial };
}

function image(partial: Omit<Extract<LayerSpec, { kind: 'image' }>, 'kind'>): LayerSpec {
  return { kind: 'image', ...partial };
}

function whiteBg(): LayerSpec {
  return image({ id: 'bg', label: 'Фон', xf: 0, yf: 0, wf: 1, hf: 1, defaultSrc: null, opacity: 1, fill: '#ffffff' });
}

/** Hand-built approximations for cube/bottle faces the source SVG export didn't include
 *  (Illustrator only exports the artboard that was active when saving). */
const EXTRA_FACES: Record<string, FaceDef[]> = {
  'rubikon-60': [
    {
      id: 'title',
      label: 'Текст',
      widthPx: 170.08,
      heightPx: 170.08,
      widthMm: 60,
      heightMm: 60,
      layers: [
        whiteBg(),
        text({ id: 'title', text: 'Оплата заказа.\nЧаевые.\nОтзыв.', xf: 0.1, yf: 0.14, wf: 0.8, fontSizeF: 0.095, align: 'center', fill: ink, fontStyle: 'bold' }),
      ],
    },
    {
      id: 'qr',
      label: 'QR + лого',
      widthPx: 170.08,
      heightPx: 170.08,
      widthMm: 60,
      heightMm: 60,
      layers: [
        whiteBg(),
        image({ id: 'qr', label: 'QR-код', xf: 0.21, yf: 0.1, wf: 0.58, hf: 0.58, defaultSrc: null, opacity: 1 }),
        text({ id: 'logo', text: 'нетмонет', xf: 0.2, yf: 0.79, wf: 0.6, fontSizeF: 0.09, align: 'center', fill: ink, fontStyle: 'bold' }),
      ],
    },
    {
      id: 'tagline',
      label: 'Слоган',
      widthPx: 170.08,
      heightPx: 170.08,
      widthMm: 60,
      heightMm: 60,
      layers: [
        whiteBg(),
        text({ id: 'tagline', text: 'Сканируй.\nПлати.\nБлагодари.', xf: 0.1, yf: 0.12, wf: 0.8, fontSizeF: 0.105, align: 'center', fill: ink, fontStyle: 'bold' }),
      ],
    },
    {
      id: 'number',
      label: 'Номер',
      widthPx: 170.08,
      heightPx: 170.08,
      widthMm: 60,
      heightMm: 60,
      layers: [
        whiteBg(),
        text({ id: 'num', text: '01', xf: 0.3, yf: 0.37, wf: 0.4, fontSizeF: 0.06, align: 'center', fill: ink, fontStyle: 'normal' }),
        text({ id: 'code', text: '1234567', xf: 0.2, yf: 0.53, wf: 0.6, fontSizeF: 0.055, align: 'center', fill: ink, fontStyle: 'normal' }),
      ],
    },
  ],
  amfora: [
    {
      id: 'back',
      label: 'Обратная сторона',
      widthPx: 170.08,
      heightPx: 368.5,
      widthMm: 60,
      heightMm: 130,
      layers: [
        whiteBg(),
        text({ id: 'num', text: '01', xf: 0.06, yf: 0.93, wf: 0.3, fontSizeF: 0.05, align: 'left', fill: ink, fontStyle: 'normal' }),
        text({ id: 'code', text: '1234567', xf: 0.5, yf: 0.93, wf: 0.44, fontSizeF: 0.05, align: 'right', fill: ink, fontStyle: 'normal' }),
      ],
    },
  ],
};

const META: Record<
  string,
  { name: string; description: string; resizableCanvas?: boolean; stackedFaces?: boolean; gridLayout?: boolean }
> = {
  azau: { name: 'Азау', description: 'Тейбл-тент из оргстекла и дерева, 50×80 мм' },
  onix: { name: 'Оникс', description: 'Круглый акрил на подставке, Ø 59 мм' },
  amfora: { name: 'Амфора', description: 'Тейбл-тент, 60×130 мм', stackedFaces: true },
  'rubikon-50': { name: 'Рубикон 50', description: 'Деревянный куб 50×50×50 мм', gridLayout: true },
  'rubikon-60': { name: 'Рубикон 60', description: 'Деревянный куб 60×60×60 мм', stackedFaces: true },
  arktika: { name: 'Арктика', description: 'Прозрачный тейбл-тент, 60×90 мм' },
  'naklejka-white': { name: 'Наклейка (белая)', description: 'Износостойкая наклейка, 80×80 мм', resizableCanvas: true },
  'naklejka-black': { name: 'Наклейка (чёрная)', description: 'Износостойкая наклейка, 80×80 мм', resizableCanvas: true },
  karelia: { name: 'Карелия', description: 'Деревянная рамка, 84×54 мм' },
};

const ORDER = [
  'azau',
  'onix',
  'amfora',
  'rubikon-50',
  'rubikon-60',
  'arktika',
  'naklejka-white',
  'naklejka-black',
  'karelia',
];

const FACE_LABELS: Record<string, string> = {
  main: 'Макет',
  front: 'Лицевая сторона',
  number: 'Номер',
  title: 'Текст',
  title2: 'Текст (2)',
  qr: 'QR + лого',
  qr2: 'QR + лого (2)',
};

// the source vector files rely on the print material's own white/black surface for these —
// there's no explicit background rect to extract, so inject one to match the physical product.
const FORCE_BG: Record<string, string> = {
  amfora: '#ffffff',
  'rubikon-50': '#ffffff',
  'rubikon-60': '#ffffff',
  arktika: '#ffffff',
  'naklejka-white': '#ffffff',
  'naklejka-black': '#0c0c0c',
};

// the source file's own "rings" print effect (a near-white radial gradient) is invisible once
// printed, so redraw it as an actual visible decorative layer, centered on the QR like the source.
const RINGS: Record<string, string> = {
  'naklejka-white': '/layers/rings-light.svg',
  'naklejka-black': '/layers/rings-dark.svg',
};

export const PRODUCTS: ProductDef[] = ORDER.map((id) => {
  let generated = (GENERATED_FACES[id] ?? []).map((f) => ({ ...f, label: FACE_LABELS[f.id] ?? f.id }));
  const extra = EXTRA_FACES[id] ?? [];

  if (FORCE_BG[id]) {
    const bgColor = FORCE_BG[id];
    generated = generated.map((f) => ({
      ...f,
      layers: [
        image({ id: 'bg', label: 'Фон', xf: 0, yf: 0, wf: 1, hf: 1, defaultSrc: null, opacity: 1, fill: bgColor }),
        ...f.layers,
      ],
    }));
  }

  if (RINGS[id]) {
    const src = RINGS[id];
    generated = generated.map((f) => ({
      ...f,
      layers: [
        f.layers[0],
        image({ id: 'rings', label: 'Кольца', xf: 0, yf: 0, wf: 1, hf: 1, defaultSrc: src, opacity: 1, decorative: true }),
        ...f.layers.slice(1),
      ],
    }));
  }

  // rubikon-60's exported SVG happened to capture the title artboard a second time (not the
  // number face) — the hand-built EXTRA_FACES set already covers all 4 faces, so skip the duplicate.
  if (id === 'rubikon-60') generated = [];

  let faces = [...extra.filter((f) => f.id === 'title' || f.id === 'qr' || f.id === 'tagline' || f.id === 'number'), ...generated, ...extra.filter((f) => f.id === 'back')];
  if (id === 'amfora') {
    // stacked view reads top-to-bottom: back side above the front
    faces = [...faces].reverse();
  }

  return {
    id,
    name: META[id].name,
    description: META[id].description,
    resizableCanvas: META[id].resizableCanvas,
    stackedFaces: META[id].stackedFaces,
    gridLayout: META[id].gridLayout,
    faces,
  };
});
