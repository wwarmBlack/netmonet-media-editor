import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { Stage, Layer as KonvaLayer, Rect, Text, TextPath, Image as KonvaImage, Group, Transformer } from 'react-konva';
import type Konva from 'konva';
import type { ProductDef, FaceDef } from './layout-types';
import { nextId, type Layer, type TextLayer, type ImageLayer } from './layers';
import { useHtmlImage } from './useImage';

const TARGET_DPI = 300;
const PT_PER_MM = 2.8346456693;
/** work at a higher internal resolution than the raw pt-sized source so editing/zooming stays crisp */
const EDIT_SCALE = 4;

function computeArcPath(w: number, h: number, sweepDeg: number): string {
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.42;
  const half = sweepDeg / 2;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const point = (deg: number) => ({
    x: cx + r * Math.sin(toRad(deg)),
    y: cy - r * Math.cos(toRad(deg)),
  });
  const p1 = point(-half);
  const p2 = point(half);
  const largeArc = sweepDeg > 180 ? 1 : 0;
  return `M ${p1.x},${p1.y} A ${r},${r} 0 ${largeArc},1 ${p2.x},${p2.y}`;
}

function buildLayersFromFace(face: FaceDef, w: number, h: number): Layer[] {
  return face.layers.map((spec) => {
    if (spec.kind === 'text') {
      const layer: TextLayer = {
        id: spec.id,
        kind: 'text',
        text: spec.text,
        x: spec.arc ? 0 : spec.xf * w,
        y: spec.arc ? 0 : spec.yf * h,
        width: spec.wf * w,
        fontSize: spec.fontSizeF * w,
        fontStyle: spec.fontStyle,
        align: spec.align,
        fill: spec.fill,
        rotation: spec.rotation ?? 0,
        arcPath: spec.arc ? computeArcPath(w, h, spec.arc.sweepDeg) : undefined,
      };
      return layer;
    }
    const layer: ImageLayer = {
      id: spec.id,
      kind: 'image',
      label: spec.label,
      src: spec.defaultSrc,
      x: spec.xf * w,
      y: spec.yf * h,
      width: spec.wf * w,
      height: spec.hf * h,
      rotation: 0,
      opacity: spec.opacity,
      decorative: spec.decorative,
      fill: spec.fill,
    };
    return layer;
  });
}

function ImageLayerNode({
  layer,
  isSelected,
  onSelect,
  registerRef,
  onChange,
}: {
  layer: ImageLayer;
  isSelected: boolean;
  onSelect: () => void;
  registerRef: (id: string, node: Konva.Node | null) => void;
  onChange: (patch: Partial<ImageLayer>) => void;
}) {
  const img = useHtmlImage(layer.src);

  return (
    <Group
      x={layer.x}
      y={layer.y}
      rotation={layer.rotation}
      opacity={layer.opacity}
      draggable
      ref={(node) => registerRef(layer.id, node)}
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e) => onChange({ x: e.target.x(), y: e.target.y() })}
      onTransformEnd={(e) => {
        const node = e.target as Konva.Group;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        node.scaleX(1);
        node.scaleY(1);
        onChange({
          x: node.x(),
          y: node.y(),
          width: Math.max(6, layer.width * scaleX),
          height: Math.max(6, layer.height * scaleY),
          rotation: node.rotation(),
        });
      }}
    >
      {img ? (
        <KonvaImage image={img} width={layer.width} height={layer.height} />
      ) : layer.fill ? (
        <Rect width={layer.width} height={layer.height} fill={layer.fill} />
      ) : (
        <Rect
          width={layer.width}
          height={layer.height}
          fill="rgba(0,0,0,0.06)"
          stroke="rgba(0,0,0,0.35)"
          strokeWidth={1}
          dash={[6, 4]}
          cornerRadius={6}
        />
      )}
      {isSelected && (
        <Rect width={layer.width} height={layer.height} stroke="#ff6a00" strokeWidth={2} listening={false} />
      )}
    </Group>
  );
}

const STACK_GAP = 48;

function buildStackedLayout(product: ProductDef): { w: number; h: number; layers: Layer[] } {
  let cursorY = 0;
  let maxW = 0;
  const merged: Layer[] = [];
  for (const f of product.faces) {
    const fw = f.widthPx * EDIT_SCALE;
    const fh = f.heightPx * EDIT_SCALE;
    maxW = Math.max(maxW, fw);
    for (const l of buildLayersFromFace(f, fw, fh)) {
      merged.push({ ...l, y: l.y + cursorY } as Layer);
    }
    cursorY += fh + STACK_GAP;
  }
  return { w: maxW, h: Math.max(0, cursorY - STACK_GAP), layers: merged };
}

export default function Editor({ product, onBack }: { product: ProductDef; onBack: () => void }) {
  const isStacked = !!product.stackedFaces;
  const [faceIndex, setFaceIndex] = useState(0);
  const face = product.faces[faceIndex];

  const initial = isStacked
    ? buildStackedLayout(product)
    : { w: face.widthPx * EDIT_SCALE, h: face.heightPx * EDIT_SCALE, layers: null as Layer[] | null };

  const [sizePx, setSizePx] = useState({ w: initial.w, h: initial.h });
  const w = sizePx.w;
  const h = sizePx.h;
  const sizeMm = { w: w / PT_PER_MM / EDIT_SCALE, h: h / PT_PER_MM / EDIT_SCALE };

  const [layers, setLayers] = useState<Layer[]>(() => initial.layers ?? buildLayersFromFace(face, w, h));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<TextLayer | null>(null);

  const stageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const nodeRefs = useRef<Map<string, Konva.Node>>(new Map());
  const containerRef = useRef<HTMLDivElement | null>(null);
  const prevSize = useRef(sizePx);

  const registerRef = useCallback((id: string, node: Konva.Node | null) => {
    if (node) nodeRefs.current.set(id, node);
    else nodeRefs.current.delete(id);
  }, []);

  useEffect(() => {
    setFaceIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  useEffect(() => {
    if (isStacked) {
      const combined = buildStackedLayout(product);
      setSizePx({ w: combined.w, h: combined.h });
      setLayers(combined.layers);
      setSelectedId(null);
      prevSize.current = { w: combined.w, h: combined.h };
      return;
    }
    const fw = face.widthPx * EDIT_SCALE;
    const fh = face.heightPx * EDIT_SCALE;
    setSizePx({ w: fw, h: fh });
    setLayers(buildLayersFromFace(face, fw, fh));
    setSelectedId(null);
    prevSize.current = { w: fw, h: fh };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id, faceIndex]);

  const [fitScale, setFitScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const recompute = () => {
      const pad = 32;
      const availW = el.clientWidth - pad;
      const availH = el.clientHeight - pad;
      const scale = Math.min(1, availW / w, availH / h);
      setFitScale(scale > 0 ? scale : 1);
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [w, h]);

  function applySizeChange(newWmm: number) {
    const newW = newWmm * PT_PER_MM * EDIT_SCALE;
    const ratio = newW / prevSize.current.w;
    const newH = prevSize.current.h * ratio;
    setLayers((prev) =>
      prev.map((l) =>
        l.kind === 'text'
          ? { ...l, x: l.x * ratio, y: l.y * ratio, width: l.width * ratio, fontSize: l.fontSize * ratio }
          : { ...l, x: l.x * ratio, y: l.y * ratio, width: l.width * ratio, height: l.height * ratio },
      ),
    );
    prevSize.current = { w: newW, h: newH };
    setSizePx({ w: newW, h: newH });
  }

  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    if (!selectedId) {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }
    const node = nodeRefs.current.get(selectedId);
    if (node) {
      tr.nodes([node]);
      tr.getLayer()?.batchDraw();
    }
  }, [selectedId, layers.length]);

  const selectedLayer = useMemo(() => layers.find((l) => l.id === selectedId) ?? null, [layers, selectedId]);

  function updateLayer(id: string, patch: Partial<Layer>) {
    setLayers((prev) => prev.map((l) => (l.id === id ? ({ ...l, ...patch } as Layer) : l)));
  }

  function deleteSelected() {
    if (!selectedId) return;
    setLayers((prev) => prev.filter((l) => l.id !== selectedId));
    setSelectedId(null);
  }

  function handleFileToLayer(id: string, file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      updateLayer(id, { src: reader.result as string } as Partial<ImageLayer>);
    };
    reader.readAsDataURL(file);
  }

  function exportPng() {
    const stage = stageRef.current;
    if (!stage) return;
    const wasSelected = selectedId;
    setSelectedId(null);
    requestAnimationFrame(() => {
      const pixelRatio = TARGET_DPI / 72 / EDIT_SCALE;
      const dataUrl = stage.toDataURL({ pixelRatio, mimeType: 'image/png' });
      const link = document.createElement('a');
      link.download = `${product.id}-${isStacked ? 'both' : face.id}-${Math.round(sizeMm.w)}x${Math.round(sizeMm.h)}.png`;
      link.href = dataUrl;
      link.click();
      if (wasSelected) setSelectedId(wasSelected);
    });
  }

  function startTextEdit(layer: TextLayer) {
    setEditingText(layer);
  }

  function commitTextEdit(value: string) {
    if (editingText) {
      updateLayer(editingText.id, { text: value } as Partial<TextLayer>);
    }
    setEditingText(null);
  }

  return (
    <div className="editor">
      <div className="toolbar">
        <button className="ghost" onClick={onBack}>
          ← Носители
        </button>
        <div className="toolbar-title">{product.name}</div>

        {!isStacked && product.faces.length > 1 && (
          <div className="face-tabs">
            {product.faces.map((f, i) => (
              <button key={f.id} className={i === faceIndex ? 'active' : ''} onClick={() => setFaceIndex(i)}>
                {f.label ?? f.id}
              </button>
            ))}
          </div>
        )}

        {product.resizableCanvas && (
          <label className="size-inputs">
            Размер
            <input
              type="number"
              min={20}
              max={400}
              value={Math.round(sizeMm.w)}
              onChange={(e) => applySizeChange(Number(e.target.value) || sizeMm.w)}
            />
            мм
          </label>
        )}

        <button className="primary" onClick={exportPng}>
          Скачать PNG
        </button>
      </div>

      <div className="workspace">
        <div className="canvas-wrap" ref={containerRef}>
          <div style={{ width: w * fitScale, height: h * fitScale }}>
            <div style={{ width: w, height: h, transform: `scale(${fitScale})`, transformOrigin: 'top left' }}>
          <Stage
            ref={stageRef}
            width={w}
            height={h}
            onMouseDown={(e) => {
              if (e.target === e.target.getStage()) setSelectedId(null);
            }}
          >
            <KonvaLayer>
              {layers.map((layer) =>
                layer.kind === 'text' ? (
                  layer.arcPath ? (
                    <TextPath
                      key={layer.id}
                      ref={(node) => registerRef(layer.id, node)}
                      data={layer.arcPath}
                      text={layer.text}
                      fontSize={layer.fontSize}
                      fontStyle={layer.fontStyle}
                      fill={layer.fill}
                      fontFamily="'Segoe UI', Arial, sans-serif"
                      draggable
                      onClick={() => setSelectedId(layer.id)}
                      onTap={() => setSelectedId(layer.id)}
                      onDblClick={() => startTextEdit(layer)}
                      onDblTap={() => startTextEdit(layer)}
                      onDragEnd={(e) => updateLayer(layer.id, { x: e.target.x(), y: e.target.y() })}
                    />
                  ) : (
                    <Text
                      key={layer.id}
                      ref={(node) => registerRef(layer.id, node)}
                      text={layer.text}
                      x={layer.x}
                      y={layer.y}
                      width={layer.width}
                      fontSize={layer.fontSize}
                      fontStyle={layer.fontStyle}
                      align={layer.align}
                      fill={layer.fill}
                      rotation={layer.rotation}
                      fontFamily="'Segoe UI', Arial, sans-serif"
                      draggable
                      onClick={() => setSelectedId(layer.id)}
                      onTap={() => setSelectedId(layer.id)}
                      onDblClick={() => startTextEdit(layer)}
                      onDblTap={() => startTextEdit(layer)}
                      onDragEnd={(e) => updateLayer(layer.id, { x: e.target.x(), y: e.target.y() })}
                      onTransformEnd={(e) => {
                        const node = e.target as Konva.Text;
                        const scaleX = node.scaleX();
                        node.scaleX(1);
                        node.scaleY(1);
                        updateLayer(layer.id, {
                          x: node.x(),
                          y: node.y(),
                          width: Math.max(20, layer.width * scaleX),
                          fontSize: Math.max(6, Math.round(layer.fontSize * node.scaleY())),
                          rotation: node.rotation(),
                        } as Partial<TextLayer>);
                      }}
                    />
                  )
                ) : (
                  <ImageLayerNode
                    key={layer.id}
                    layer={layer}
                    isSelected={selectedId === layer.id}
                    onSelect={() => setSelectedId(layer.id)}
                    registerRef={registerRef}
                    onChange={(patch) => updateLayer(layer.id, patch)}
                  />
                ),
              )}

              <Transformer
                ref={transformerRef}
                rotateEnabled
                boundBoxFunc={(oldBox, newBox) => (newBox.width < 8 || newBox.height < 8 ? oldBox : newBox)}
              />
            </KonvaLayer>
          </Stage>
            </div>
          </div>

          {editingText && (
            <textarea
              autoFocus
              className="inline-editor"
              defaultValue={editingText.text}
              onBlur={(e) => commitTextEdit(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setEditingText(null);
                if (e.key === 'Enter' && e.ctrlKey) commitTextEdit((e.target as HTMLTextAreaElement).value);
              }}
            />
          )}
        </div>

        <div className="side-panel">
          <h3>Слои</h3>
          <ul className="layer-list">
            {layers.map((l) => (
              <li key={l.id} className={l.id === selectedId ? 'active' : ''} onClick={() => setSelectedId(l.id)}>
                {l.kind === 'text' ? `Текст: ${l.text.split('\n')[0].slice(0, 18)}` : l.label}
                {l.kind === 'image' && l.decorative && <span className="tag">графика</span>}
              </li>
            ))}
          </ul>

          {selectedLayer?.kind === 'text' && (
            <div className="props">
              <h4>Текст</h4>
              <label>
                Содержимое
                <textarea
                  value={selectedLayer.text}
                  onChange={(e) => updateLayer(selectedLayer.id, { text: e.target.value } as Partial<TextLayer>)}
                />
              </label>
              <label>
                Размер шрифта
                <input
                  type="range"
                  min={4}
                  max={Math.round(w * 0.25)}
                  value={selectedLayer.fontSize}
                  onChange={(e) =>
                    updateLayer(selectedLayer.id, { fontSize: Number(e.target.value) } as Partial<TextLayer>)
                  }
                />
              </label>
              <label>
                Цвет
                <input
                  type="color"
                  value={selectedLayer.fill}
                  onChange={(e) => updateLayer(selectedLayer.id, { fill: e.target.value } as Partial<TextLayer>)}
                />
              </label>
              <label className="row">
                Жирный
                <input
                  type="checkbox"
                  checked={selectedLayer.fontStyle === 'bold'}
                  onChange={(e) =>
                    updateLayer(selectedLayer.id, {
                      fontStyle: e.target.checked ? 'bold' : 'normal',
                    } as Partial<TextLayer>)
                  }
                />
              </label>
              <button className="danger" onClick={deleteSelected}>
                Удалить слой
              </button>
            </div>
          )}

          {selectedLayer?.kind === 'image' && (
            <div className="props">
              <h4>{selectedLayer.label}</h4>
              <label>
                Прозрачность
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={selectedLayer.opacity}
                  onChange={(e) =>
                    updateLayer(selectedLayer.id, { opacity: Number(e.target.value) } as Partial<ImageLayer>)
                  }
                />
              </label>
              <label className="upload-btn full">
                Загрузить изображение
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handleFileToLayer(selectedLayer.id, e.target.files[0])}
                />
              </label>
              {selectedLayer.src && (
                <button className="ghost" onClick={() => updateLayer(selectedLayer.id, { src: null } as Partial<ImageLayer>)}>
                  Убрать изображение
                </button>
              )}
              <button className="danger" onClick={deleteSelected}>
                Удалить слой
              </button>
            </div>
          )}

          {!selectedLayer && <p className="hint">Кликните по элементу на макете, чтобы отредактировать его.</p>}

          <div className="add-buttons">
            <button
              className="ghost full"
              onClick={() => {
                const t: TextLayer = {
                  id: nextId('text'),
                  kind: 'text',
                  text: 'Новый текст',
                  x: w * 0.2,
                  y: h * 0.5,
                  width: w * 0.6,
                  fontSize: Math.round(w * 0.06),
                  fontStyle: 'normal',
                  align: 'center',
                  fill: '#1c1c1c',
                  rotation: 0,
                };
                setLayers((prev) => [...prev, t]);
                setSelectedId(t.id);
              }}
            >
              + Добавить текст
            </button>
            <button
              className="ghost full"
              onClick={() => {
                const size = Math.min(w, h) * 0.25;
                const img: ImageLayer = {
                  id: nextId('logo'),
                  kind: 'image',
                  label: 'Изображение',
                  src: null,
                  x: (w - size) / 2,
                  y: (h - size) / 2,
                  width: size,
                  height: size,
                  rotation: 0,
                  opacity: 1,
                };
                setLayers((prev) => [...prev, img]);
                setSelectedId(img.id);
              }}
            >
              + Добавить лого/изображение
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
