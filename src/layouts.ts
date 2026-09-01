export const PX_PER_MM = 6;
export const TARGET_DPI = 300;

export type Align = 'left' | 'center' | 'right';

export interface TextSpec {
  kind: 'text';
  id: string;
  text: string;
  xf: number;
  yf: number;
  wf: number;
  fontSizeF: number; // fraction of face width
  align: Align;
  fill: string;
  fontStyle: 'normal' | 'bold';
  rotation?: number;
  /** render along a circular arc instead of a straight line */
  arc?: { sweepDeg: number };
}

export interface ImageSpec {
  kind: 'image';
  id: string;
  label: string;
  xf: number;
  yf: number;
  /** square size as a fraction of min(faceWidth, faceHeight) */
  sizeF: number;
  backing: 'white' | 'none';
}

export type LayerSpec = TextSpec | ImageSpec;

export interface FaceDef {
  id: string;
  label: string;
  background: string;
  decorations?: 'rings' | 'divider' | 'none';
  layers: LayerSpec[];
}

export type Shape = 'rect' | 'square' | 'circle';

export interface ProductDef {
  id: string;
  name: string;
  description: string;
  shape: Shape;
  widthMm: number;
  heightMm: number;
  cornerRadiusF?: number;
  accentBorder?: string;
  resizableCanvas?: boolean;
  faces: FaceDef[];
}

const white = '#ffffff';
const ink = '#1c1c1c';
const gray = '#8a8a8a';
const bgGray = '#a7abae';
const pink = '#e6007e';

function qr(id: string, xf: number, yf: number, sizeF: number, backing: 'white' | 'none' = 'none'): ImageSpec {
  return { kind: 'image', id, label: 'QR-код', xf, yf, sizeF, backing };
}

function text(partial: Omit<TextSpec, 'kind'>): TextSpec {
  return { kind: 'text', ...partial };
}

function logoFace(w: number, h: number, bg: string, fg: string): FaceDef {
  return {
    id: 'qr',
    label: 'QR + лого',
    background: bg,
    layers: [
      qr('qr', 0.5 - 0.29, h > w ? 0.12 : 0.1, 0.58, 'none'),
      text({ id: 'logo', text: 'нетмонет', xf: 0.2, yf: 0.79, wf: 0.6, fontSizeF: 0.09, align: 'center', fill: fg, fontStyle: 'bold' }),
    ],
  };
}

function numberFace(fg: string): FaceDef {
  return {
    id: 'number',
    label: 'Номер',
    background: white,
    decorations: 'divider',
    layers: [
      text({ id: 'num', text: '01', xf: 0.3, yf: 0.37, wf: 0.4, fontSizeF: 0.07, align: 'center', fill: fg, fontStyle: 'normal' }),
      text({ id: 'code', text: '1234567', xf: 0.2, yf: 0.55, wf: 0.6, fontSizeF: 0.062, align: 'center', fill: fg, fontStyle: 'normal' }),
    ],
  };
}

export const PRODUCTS: ProductDef[] = [
  {
    id: 'azau',
    name: 'Азау',
    description: 'Тейбл-тент из оргстекла и дерева, 50×80 мм',
    shape: 'rect',
    widthMm: 50,
    heightMm: 80,
    faces: [
      {
        id: 'main',
        label: 'Макет',
        background: bgGray,
        layers: [
          text({ id: 'title', text: 'Оплата заказа.\nЧаевые. Отзыв.', xf: 0.05, yf: 0.11, wf: 0.9, fontSizeF: 0.1, align: 'center', fill: white, fontStyle: 'bold' }),
          text({ id: 'subtitle', text: 'Оплатите заказ без официанта.\nЦеликом или только свою часть.', xf: 0.06, yf: 0.29, wf: 0.88, fontSizeF: 0.05, align: 'center', fill: white, fontStyle: 'normal' }),
          qr('qr', 0.19, 0.4, 0.62, 'white'),
          text({ id: 'num', text: '01', xf: 0.3, yf: 0.86, wf: 0.4, fontSizeF: 0.055, align: 'center', fill: white, fontStyle: 'normal' }),
          text({ id: 'code', text: '111222', xf: 0.2, yf: 0.93, wf: 0.6, fontSizeF: 0.052, align: 'center', fill: white, fontStyle: 'normal' }),
        ],
      },
    ],
  },
  {
    id: 'onix',
    name: 'Оникс',
    description: 'Круглый акрил на подставке, Ø 59 мм',
    shape: 'circle',
    widthMm: 59,
    heightMm: 59,
    faces: [
      {
        id: 'main',
        label: 'Макет',
        background: '#d9d9d9',
        layers: [
          text({ id: 'title', text: 'Оплата заказа. Чаевые. Отзыв.', xf: 0, yf: 0, wf: 1, fontSizeF: 0.072, align: 'center', fill: white, fontStyle: 'bold', arc: { sweepDeg: 250 } }),
          text({ id: 'subtitle', text: 'Всё в одном\nQR-коде', xf: 0.2, yf: 0.17, wf: 0.6, fontSizeF: 0.05, align: 'center', fill: '#6b6b6b', fontStyle: 'normal' }),
          text({ id: 'numLeft', text: '1234567', xf: 0.02, yf: 0.42, wf: 0.16, fontSizeF: 0.034, align: 'center', fill: gray, fontStyle: 'normal', rotation: -90 }),
          text({ id: 'numRight', text: '07', xf: 0.82, yf: 0.5, wf: 0.14, fontSizeF: 0.045, align: 'center', fill: gray, fontStyle: 'normal' }),
          qr('qr', 0.3, 0.32, 0.4, 'white'),
          text({ id: 'logo', text: 'нетмонет', xf: 0.2, yf: 0.82, wf: 0.6, fontSizeF: 0.065, align: 'center', fill: white, fontStyle: 'bold' }),
        ],
      },
    ],
  },
  {
    id: 'amfora',
    name: 'Амфора',
    description: 'Тейбл-тент, 60×130 мм',
    shape: 'rect',
    widthMm: 60,
    heightMm: 130,
    faces: [
      {
        id: 'front',
        label: 'Лицевая сторона',
        background: white,
        layers: [
          text({ id: 'title', text: 'Оплата заказа.\nЧаевые. Отзыв.', xf: 0.08, yf: 0.46, wf: 0.84, fontSizeF: 0.105, align: 'left', fill: ink, fontStyle: 'bold' }),
          qr('qr', 0.13, 0.58, 0.74, 'none'),
          text({ id: 'logo', text: 'нетмонет', xf: 0.1, yf: 0.935, wf: 0.8, fontSizeF: 0.075, align: 'center', fill: ink, fontStyle: 'bold' }),
        ],
      },
      {
        id: 'back',
        label: 'Обратная сторона',
        background: white,
        layers: [
          text({ id: 'num', text: '01', xf: 0.06, yf: 0.93, wf: 0.3, fontSizeF: 0.05, align: 'left', fill: ink, fontStyle: 'normal' }),
          text({ id: 'code', text: '1234567', xf: 0.5, yf: 0.93, wf: 0.44, fontSizeF: 0.05, align: 'right', fill: ink, fontStyle: 'normal' }),
        ],
      },
    ],
  },
  {
    id: 'rubikon-50',
    name: 'Рубикон 50',
    description: 'Деревянный куб 50×50×50 мм',
    shape: 'square',
    widthMm: 50,
    heightMm: 50,
    faces: [
      {
        id: 'title',
        label: 'Текст',
        background: white,
        layers: [
          text({ id: 'title', text: 'Меню.\nОплата заказа.\nЧаевые.', xf: 0.1, yf: 0.32, wf: 0.8, fontSizeF: 0.095, align: 'center', fill: ink, fontStyle: 'bold' }),
        ],
      },
      logoFace(50, 50, white, ink),
      numberFace(ink),
    ],
  },
  {
    id: 'rubikon-60',
    name: 'Рубикон 60',
    description: 'Деревянный куб 60×60×60 мм',
    shape: 'square',
    widthMm: 60,
    heightMm: 60,
    faces: [
      {
        id: 'title',
        label: 'Текст',
        background: white,
        layers: [
          text({ id: 'title', text: 'Оплата заказа.\nЧаевые.\nОтзыв.', xf: 0.1, yf: 0.14, wf: 0.8, fontSizeF: 0.095, align: 'center', fill: ink, fontStyle: 'bold' }),
        ],
      },
      logoFace(60, 60, white, ink),
      {
        id: 'tagline',
        label: 'Слоган',
        background: white,
        layers: [
          text({ id: 'tagline', text: 'Сканируй.\nПлати.\nБлагодари.', xf: 0.1, yf: 0.12, wf: 0.8, fontSizeF: 0.105, align: 'center', fill: ink, fontStyle: 'bold' }),
        ],
      },
      numberFace(ink),
    ],
  },
  {
    id: 'arktika',
    name: 'Арктика',
    description: 'Прозрачный тейбл-тент, 60×90 мм',
    shape: 'rect',
    widthMm: 60,
    heightMm: 90,
    faces: [
      {
        id: 'main',
        label: 'Макет',
        background: white,
        layers: [
          text({ id: 'title', text: 'Оплата заказа.\nЧаевые. Отзыв.', xf: 0.09, yf: 0.04, wf: 0.82, fontSizeF: 0.1, align: 'left', fill: ink, fontStyle: 'bold' }),
          text({ id: 'subtitle', text: 'Оплатите заказ без официанта.\nЦеликом или только свою часть.', xf: 0.09, yf: 0.175, wf: 0.82, fontSizeF: 0.046, align: 'left', fill: '#333333', fontStyle: 'normal' }),
          qr('qr', 0.09, 0.3, 0.82, 'none'),
          text({ id: 'numvert', text: '1234567- 01', xf: -0.03, yf: 0.45, wf: 0.16, fontSizeF: 0.032, align: 'center', fill: gray, fontStyle: 'normal', rotation: -90 }),
          text({ id: 'logo', text: 'нетмонет', xf: 0.1, yf: 0.885, wf: 0.8, fontSizeF: 0.065, align: 'center', fill: ink, fontStyle: 'bold' }),
        ],
      },
    ],
  },
  {
    id: 'naklejka-white',
    name: 'Наклейка (белая)',
    description: 'Износостойкая наклейка, 80×80 мм',
    shape: 'square',
    widthMm: 80,
    heightMm: 80,
    cornerRadiusF: 0.12,
    accentBorder: pink,
    resizableCanvas: true,
    faces: [
      {
        id: 'main',
        label: 'Макет',
        background: white,
        decorations: 'rings',
        layers: [
          text({ id: 'num', text: '07', xf: 0.64, yf: 0.38, wf: 0.2, fontSizeF: 0.045, align: 'center', fill: '#9a9a9a', fontStyle: 'normal' }),
          text({ id: 'title', text: 'Оплата заказа.\nЧаевые. Отзыв.', xf: 0.1, yf: 0.07, wf: 0.62, fontSizeF: 0.078, align: 'left', fill: ink, fontStyle: 'bold' }),
          text({ id: 'subtitle', text: 'Оплатите заказ без\nофицианта. Целиком\nили только свою часть.', xf: 0.1, yf: 0.32, wf: 0.42, fontSizeF: 0.042, align: 'left', fill: '#9a9a9a', fontStyle: 'normal' }),
          text({ id: 'logo', text: 'нетмонет', xf: 0.1, yf: 0.52, wf: 0.5, fontSizeF: 0.07, align: 'left', fill: ink, fontStyle: 'bold' }),
          text({ id: 'codevert', text: '1234567', xf: 0.87, yf: 0.58, wf: 0.12, fontSizeF: 0.028, align: 'center', fill: '#9a9a9a', fontStyle: 'normal', rotation: -90 }),
          qr('qr', 0.56, 0.5, 0.38, 'white'),
        ],
      },
    ],
  },
  {
    id: 'naklejka-black',
    name: 'Наклейка (чёрная)',
    description: 'Износостойкая наклейка, 80×80 мм',
    shape: 'square',
    widthMm: 80,
    heightMm: 80,
    cornerRadiusF: 0.12,
    accentBorder: pink,
    resizableCanvas: true,
    faces: [
      {
        id: 'main',
        label: 'Макет',
        background: '#0c0c0c',
        decorations: 'rings',
        layers: [
          text({ id: 'num', text: '07', xf: 0.64, yf: 0.38, wf: 0.2, fontSizeF: 0.045, align: 'center', fill: '#8a8a8a', fontStyle: 'normal' }),
          text({ id: 'title', text: 'Оплата заказа.\nЧаевые. Отзыв.', xf: 0.1, yf: 0.07, wf: 0.62, fontSizeF: 0.078, align: 'left', fill: white, fontStyle: 'bold' }),
          text({ id: 'subtitle', text: 'Оплатите заказ без\nофицианта. Целиком\nили только свою часть.', xf: 0.1, yf: 0.32, wf: 0.42, fontSizeF: 0.042, align: 'left', fill: '#8a8a8a', fontStyle: 'normal' }),
          text({ id: 'logo', text: 'нетмонет', xf: 0.1, yf: 0.52, wf: 0.5, fontSizeF: 0.07, align: 'left', fill: white, fontStyle: 'bold' }),
          text({ id: 'codevert', text: '1234567', xf: 0.87, yf: 0.58, wf: 0.12, fontSizeF: 0.028, align: 'center', fill: '#8a8a8a', fontStyle: 'normal', rotation: -90 }),
          qr('qr', 0.56, 0.5, 0.38, 'white'),
        ],
      },
    ],
  },
  {
    id: 'karelia',
    name: 'Карелия',
    description: 'Деревянная рамка, 84×54 мм',
    shape: 'rect',
    widthMm: 84,
    heightMm: 54,
    faces: [
      {
        id: 'main',
        label: 'Макет',
        background: bgGray,
        layers: [
          qr('qr', 0.07, 0.12, 0.42, 'white'),
          text({ id: 'num', text: '01', xf: 0.07, yf: 0.02, wf: 0.3, fontSizeF: 0.075, align: 'left', fill: ink, fontStyle: 'normal' }),
          text({ id: 'code', text: '111222', xf: 0.07, yf: 0.82, wf: 0.34, fontSizeF: 0.06, align: 'left', fill: ink, fontStyle: 'normal' }),
          text({ id: 'title', text: 'Оплата заказа.\nЧаевые. Отзыв.', xf: 0.42, yf: 0.16, wf: 0.56, fontSizeF: 0.07, align: 'left', fill: ink, fontStyle: 'bold' }),
          text({ id: 'subtitle', text: 'Оплатите заказ\nбез официанта.\nЦеликом или\nтолько свою часть.', xf: 0.42, yf: 0.5, wf: 0.56, fontSizeF: 0.046, align: 'left', fill: '#333333', fontStyle: 'normal' }),
        ],
      },
    ],
  },
];
