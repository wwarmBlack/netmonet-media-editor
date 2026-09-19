import { useEffect, useState } from 'react';

/** Composite over white, then turn "whiteness" into transparency: the QR keeps its black
 *  modules and picks up whatever background is behind it instead of carrying a white box. */
function knockOutWhite(img: HTMLImageElement): HTMLCanvasElement {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < d.data.length; i += 4) {
    const luma = 0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2];
    d.data[i] = d.data[i + 1] = d.data[i + 2] = 0;
    d.data[i + 3] = Math.round(255 - luma);
  }
  ctx.putImageData(d, 0, 0);
  return c;
}

/** Repaint every visible pixel with one color, keeping the layer's shape (alpha) intact. */
function tintImage(img: HTMLImageElement, color: string): HTMLCanvasElement {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0, w, h);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  return c;
}

export function useHtmlImage(
  src: string | null,
  opts?: { knockOutWhite?: boolean; tint?: string },
): HTMLImageElement | HTMLCanvasElement | null {
  const [img, setImg] = useState<HTMLImageElement | HTMLCanvasElement | null>(null);
  const knock = !!opts?.knockOutWhite;
  const tint = opts?.tint;

  useEffect(() => {
    if (!src) {
      setImg(null);
      return;
    }
    const image = new window.Image();
    image.onload = () => setImg(knock ? knockOutWhite(image) : tint ? tintImage(image, tint) : image);
    image.src = src;
    return () => {
      image.onload = null;
    };
  }, [src, knock, tint]);

  return img;
}
