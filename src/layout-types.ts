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
  /** raw SVG path 'd', in the face's own widthPx/heightPx coordinate space */
  arcData?: string;
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
}

export interface ProductDef {
  id: string;
  name: string;
  description: string;
  resizableCanvas?: boolean;
  faces: FaceDef[];
}
