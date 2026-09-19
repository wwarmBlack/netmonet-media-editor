export interface QrSource {
  name: string;
  dataUrl: string;
  /** vector twin (same base name) if the archive has one — rasterized sharper than the PNG */
  svgDataUrl?: string;
}

/** Parses "1-10, 15-19, 21-26" (also accepts single numbers and newlines) into an ordered list. */
export function parseNumberRanges(input: string): number[] {
  const out: number[] = [];
  const parts = input
    .split(/[,;\n]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  for (const part of parts) {
    const m = /^(\d+)\s*-\s*(\d+)$/.exec(part);
    if (m) {
      const a = parseInt(m[1], 10);
      const b = parseInt(m[2], 10);
      const [lo, hi] = a <= b ? [a, b] : [b, a];
      for (let n = lo; n <= hi; n++) out.push(n);
      continue;
    }
    const single = /^(\d+)$/.exec(part);
    if (single) out.push(parseInt(single[1], 10));
  }
  return out;
}

export function padNumber(n: number, list: number[]): string {
  const width = Math.max(2, ...list.map((x) => String(x).length));
  return String(n).padStart(width, '0');
}

function naturalCompare(a: string, b: string): number {
  const re = /(\d+)|(\D+)/g;
  const ax = a.match(re) ?? [];
  const bx = b.match(re) ?? [];
  const len = Math.max(ax.length, bx.length);
  for (let i = 0; i < len; i++) {
    const av = ax[i] ?? '';
    const bv = bx[i] ?? '';
    if (av === bv) continue;
    const an = Number(av);
    const bn = Number(bv);
    if (!Number.isNaN(an) && !Number.isNaN(bn)) return an - bn;
    return av < bv ? -1 : 1;
  }
  return 0;
}

function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const IMAGE_EXT = /\.(png|jpe?g|webp|svg|gif)$/i;
// each QR is typically exported as a PNG+SVG pair with the same base name — prefer the raster
// version (renders reliably on canvas) and only fall back to others if PNG isn't present
const FORMAT_PRIORITY = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'];

function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, '');
}

/** Collapses same-QR PNG+SVG (etc.) pairs sharing a base filename down to one entry each. */
function dedupeByBaseName<T extends { name: string }>(entries: T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const e of entries) {
    const key = baseName(e.name);
    const arr = groups.get(key) ?? [];
    arr.push(e);
    groups.set(key, arr);
  }
  const out: T[] = [];
  for (const group of groups.values()) {
    group.sort((a, b) => {
      const ai = FORMAT_PRIORITY.findIndex((ext) => a.name.toLowerCase().endsWith(ext));
      const bi = FORMAT_PRIORITY.findIndex((ext) => b.name.toLowerCase().endsWith(ext));
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    out.push(group[0]);
  }
  return out.sort((a, b) => naturalCompare(a.name, b.name));
}

/** Accepts either a single .zip of QR images, or a plain list of image files. Same-name
 *  PNG+SVG pairs collapse to one QR each; results are naturally sorted by filename. */
export async function readQrSources(files: File[]): Promise<QrSource[]> {
  if (files.length === 1 && /\.zip$/i.test(files[0].name)) {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(files[0]);
    const all = Object.values(zip.files)
      .filter((f) => !f.dir && IMAGE_EXT.test(f.name))
      .map((f) => ({ name: f.name.split('/').pop() ?? f.name, entry: f }));
    const entries = dedupeByBaseName(all);
    const out: QrSource[] = [];
    for (const { name, entry } of entries) {
      const blob = await entry.async('blob');
      const svgTwin = all.find((a) => baseName(a.name) === baseName(name) && /\.svg$/i.test(a.name));
      out.push({
        name,
        dataUrl: await fileToDataUrl(blob),
        svgDataUrl: svgTwin ? await fileToDataUrl(new Blob([await svgTwin.entry.async('arraybuffer')], { type: 'image/svg+xml' })) : undefined,
      });
    }
    return out;
  }

  const deduped = dedupeByBaseName(files.map((f) => ({ name: f.name, file: f })));
  const out: QrSource[] = [];
  for (const { name, file } of deduped) {
    out.push({ name, dataUrl: await fileToDataUrl(file) });
  }
  return out;
}

export function loadImage(src: string, timeoutMs = 8000): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const timer = setTimeout(() => reject(new Error('image load timed out')), timeoutMs);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error('image failed to load'));
    };
    img.src = src;
  });
}

/**
 * QR exports ship with their own built-in white margin (often 4+ modules), which makes the
 * actual black pattern look small once dropped into a slot that already sits on a white
 * backing. Rasterize (SVG when available, for crisp edges), crop to the dark modules, and
 * re-pad with a small quiet zone so the code fills its slot.
 */
export async function prepareQrForSlot(src: QrSource): Promise<string> {
  const source = src.svgDataUrl ?? src.dataUrl;
  const img = await loadImage(source);
  const nat = Math.max(img.naturalWidth || 300, img.naturalHeight || 300);
  const base = src.svgDataUrl ? 1600 : nat;
  const aspect = (img.naturalWidth || 1) / (img.naturalHeight || 1);
  const w = aspect >= 1 ? base : Math.round(base * aspect);
  const h = aspect >= 1 ? Math.round(base / aspect) : base;

  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = !!src.svgDataUrl;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  const data = ctx.getImageData(0, 0, w, h).data;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (data[i] + data[i + 1] + data[i + 2] < 3 * 110) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return src.dataUrl;

  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const side = Math.max(cw, ch);
  const pad = Math.round(side * 0.055);
  const out = document.createElement('canvas');
  out.width = out.height = side + pad * 2;
  const octx = out.getContext('2d')!;
  octx.fillStyle = '#fff';
  octx.fillRect(0, 0, out.width, out.height);
  octx.imageSmoothingEnabled = false;
  octx.drawImage(c, minX, minY, cw, ch, pad + (side - cw) / 2, pad + (side - ch) / 2, cw, ch);
  return out.toDataURL('image/png');
}
