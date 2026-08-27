export type Shape = 'rect' | 'square' | 'circle' | 'landscape';

export interface SizeOption {
  label: string;
  widthMm: number;
  heightMm: number;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  shape: Shape;
  /** design canvas size in px at the default/first size option */
  defaultBackground: string;
  defaultTextColor: string;
  resizable: boolean;
  sizes: SizeOption[];
}

export const PRODUCTS: Product[] = [
  {
    id: 'azau',
    name: 'Азау',
    description: 'Тейбл-тент из оргстекла и дерева',
    shape: 'rect',
    defaultBackground: '#eef0f2',
    defaultTextColor: '#1c1c1c',
    resizable: false,
    sizes: [{ label: '90 x 110 мм', widthMm: 90, heightMm: 110 }],
  },
  {
    id: 'arktika',
    name: 'Арктика',
    description: 'Прозрачный тейбл-тент из оргстекла',
    shape: 'rect',
    defaultBackground: '#f4f5f6',
    defaultTextColor: '#1c1c1c',
    resizable: false,
    sizes: [{ label: '90 x 110 мм', widthMm: 90, heightMm: 110 }],
  },
  {
    id: 'onix',
    name: 'Оникс',
    description: 'Круглый акрил на подставке',
    shape: 'circle',
    defaultBackground: '#e4e4e4',
    defaultTextColor: '#1c1c1c',
    resizable: false,
    sizes: [{ label: 'Ø 90 мм', widthMm: 90, heightMm: 90 }],
  },
  {
    id: 'vudi',
    name: 'Вуди',
    description: 'Квадратный акрил на деревянной подставке',
    shape: 'square',
    defaultBackground: '#141414',
    defaultTextColor: '#ffffff',
    resizable: false,
    sizes: [{ label: '90 x 90 мм', widthMm: 90, heightMm: 90 }],
  },
  {
    id: 'rubikon',
    name: 'Рубикон',
    description: 'Деревянный куб',
    shape: 'square',
    defaultBackground: '#c8946a',
    defaultTextColor: '#1c1c1c',
    resizable: false,
    sizes: [{ label: '50 x 50 мм', widthMm: 50, heightMm: 50 }],
  },
  {
    id: 'karelia',
    name: 'Карелия',
    description: 'Деревянная рамка',
    shape: 'landscape',
    defaultBackground: '#f4f5f6',
    defaultTextColor: '#1c1c1c',
    resizable: false,
    sizes: [{ label: '110 x 90 мм', widthMm: 110, heightMm: 90 }],
  },
  {
    id: 'naklejka',
    name: 'Наклейка',
    description: 'Износостойкая наклейка',
    shape: 'circle',
    defaultBackground: '#141414',
    defaultTextColor: '#ffffff',
    resizable: true,
    sizes: [{ label: '80 x 80 мм', widthMm: 80, heightMm: 80 }],
  },
  {
    id: '3d-naklejka',
    name: '3D-наклейка',
    description: 'Объёмная 3D-наклейка',
    shape: 'square',
    defaultBackground: '#141414',
    defaultTextColor: '#ffffff',
    resizable: true,
    sizes: [
      { label: '50 x 50 мм', widthMm: 50, heightMm: 50 },
      { label: '80 x 80 мм', widthMm: 80, heightMm: 80 },
      { label: '110 x 110 мм', widthMm: 110, heightMm: 110 },
    ],
  },
];

export const PHRASE_WITH_MENU = 'Меню.\nОплата заказа.\nБлагодарность.';
export const PHRASE_WITHOUT_MENU = 'Оплата заказа\nи благодарность';
export const SUBPHRASE_WITH_MENU = 'Всё в одном QR-коде';
export const SUBPHRASE_WITHOUT_MENU = 'Оплатите заказ без официанта.\nЦеликом или только свою часть.';
