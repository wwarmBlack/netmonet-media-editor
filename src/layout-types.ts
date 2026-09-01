export type Align = 'left' | 'center' | 'right';

export interface TextSpec {
  kind: 'text';
  id: string;
  text: string;
  xf: number;
  yf: number;
  wf: number;
  fontSizeF: number;
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
  wf: number;
  hf: number;
  defaultSrc: string | null;
  opacity: number;
  /** decorative art extracted from the source file (rings, gradients, panels, borders, logo) — still fully editable */
  decorative?: boolean;
  /** solid color shown while there's no image (or as a plain color layer, e.g. a page background) */
  fill?: string;
}

export type LayerSpec = TextSpec | ImageSpec;

export interface FaceDef {
  id: string;
  label?: string;
  widthPx: number;
  heightPx: number;
  widthMm: number;
  heightMm: number;
  layers: LayerSpec[];
  /** for gridLayout products: position of this face within the printed net */
  gridRow?: number;
  gridCol?: number;
}

export interface ProductDef {
  id: string;
  name: string;
  description: string;
  resizableCanvas?: boolean;
  /** stack all faces vertically in one canvas/export instead of tabbed switching */
  stackedFaces?: boolean;
  /** arrange faces on a 2D grid (using each face's gridRow/gridCol) instead of tabbed switching */
  gridLayout?: boolean;
  faces: FaceDef[];
}
