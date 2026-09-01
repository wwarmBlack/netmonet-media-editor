export interface TextLayer {
  id: string;
  kind: 'text';
  text: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  fontStyle: 'normal' | 'bold';
  align: 'left' | 'center' | 'right';
  fill: string;
  rotation: number;
  arcPath?: string;
}

export interface ImageLayer {
  id: string;
  kind: 'image';
  label: string;
  src: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  decorative?: boolean;
}

export type Layer = TextLayer | ImageLayer;

let counter = 0;
export function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}
