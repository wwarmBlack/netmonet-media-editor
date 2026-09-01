import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import {
  Stage,
  Layer as KonvaLayer,
  Rect,
  Circle,
  Text,
  TextPath,
  Image as KonvaImage,
  Group,
  Transformer,
} from 'react-konva';
import type Konva from 'konva';
import { PX_PER_MM, TARGET_DPI, type ProductDef, type FaceDef } from './layouts';
import { nextId, type Layer, type TextLayer, type ImageLayer } from './layers';
import { useHtmlImage } from './useImage';

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
    const size = spec.sizeF * Math.min(w, h);
    const layer: ImageLayer = {
      id: spec.id,
      kind: 'image',
      label: spec.label,
      src: null,
      x: spec.xf * w,
      y: spec.yf * h,
      width: size,
      height: size,
      rotation: 0,
      backing: spec.backing,
    };
    return layer;
  });
}

function RingsDecoration({ w, h }: { w: number; h: number }) {
  const cx = w * 0.75;
  const cy = h * 0.69;
  const maxR = Math.min(w, h) * 0.56;
  const rings = [0.28, 0.42, 0.56, 0.7, 0.85, 1].map((f) => f * maxR);
  return (
    <>
      {rings.map((r, i) => (
        <Circle key={i} x={cx} y={cy} radius={r} stroke="rgba(128,128,128,0.22)" strokeWidth={1} listening={false} />
      ))}
    </>
  );
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
  const pad = layer.backing === 'white' ? layer.width * 0.12 : 0;

  return (
    <Group
      x={layer.x}
      y={layer.y}
      rotation={layer.rotation}
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
          width: Math.max(10, layer.width * scaleX),
          height: Math.max(10, layer.height * scaleY),
          rotation: node.rotation(),
        });
      }}
    >
      {layer.backing === 'white' && (
        <Rect
          x={-pad}
          y={-pad}
          width={layer.width + 2 * pad}
          height={layer.height + 2 * pad}
          fill="#ffffff"
          cornerRadius={(layer.width + 2 * pad) * 0.1}
        />
      )}
      {img ? (
        <KonvaImage image={img} width={layer.width} height={layer.height} />
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
        <Rect
          x={-pad - 2}
          y={-pad - 2}
          width={layer.width + 2 * pad + 4}
          height={layer.height + 2 * pad + 4}
          stroke="#ff6a00"
          strokeWidth={2}
          listening={false}
        />
      )}
    </Group>
  );
}

function clipForShape(shape: ProductDef['shape'], w: number, h: number, cornerRadiusF = 0.06) {
  return (ctx: Konva.Context) => {
    if (shape === 'circle') {
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, Math.min(w, h) / 2, 0, Math.PI * 2, false);
      ctx.closePath();
      return;
    }
    const r = Math.min(cornerRadiusF * Math.min(w, h), w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(w - r, 0);
    ctx.arcTo(w, 0, w, r, r);
    ctx.lineTo(w, h - r);
    ctx.arcTo(w, h, w - r, h, r);
    ctx.lineTo(r, h);
    ctx.arcTo(0, h, 0, h - r, r);
    ctx.lineTo(0, r);
    ctx.arcTo(0, 0, r, 0, r);
    ctx.closePath();
  };
}

export default function Editor({ product, onBack }: { product: ProductDef; onBack: () => void }) {
  const [faceIndex, setFaceIndex] = useState(0);
  const face = product.faces[faceIndex];

  const [sizeMm, setSizeMm] = useState({ w: product.widthMm, h: product.heightMm });
  const w = Math.round(sizeMm.w * PX_PER_MM);
  const h = Math.round(sizeMm.h * PX_PER_MM);

  const [background, setBackground] = useState<{ color: string; imageSrc: string | null }>({
    color: face.background,
    imageSrc: null,
  });

  const [layers, setLayers] = useState<Layer[]>(() => buildLayersFromFace(face, w, h));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<TextLayer | null>(null);

  const stageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const nodeRefs = useRef<Map<string, Konva.Node>>(new Map());
  const containerRef = useRef<HTMLDivElement | null>(null);
  const prevSize = useRef(sizeMm);

  const registerRef = useCallback((id: string, node: Konva.Node | null) => {
    if (node) nodeRefs.current.set(id, node);
    else nodeRefs.current.delete(id);
  }, []);

  useEffect(() => {
    setSizeMm({ w: product.widthMm, h: product.heightMm });
    setFaceIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  useEffect(() => {
    const fw = Math.round(sizeMm.w * PX_PER_MM);
    const fh = Math.round(sizeMm.h * PX_PER_MM);
    setLayers(buildLayersFromFace(face, fw, fh));
    setBackground({ color: face.background, imageSrc: null });
    setSelectedId(null);
    prevSize.current = sizeMm;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id, faceIndex]);

  function applySizeChange(next: { w: number; h: number }) {
    const ratioX = next.w / prevSize.current.w;
    const ratioY = next.h / prevSize.current.h;
    setLayers((prev) =>
      prev.map((l) =>
        l.kind === 'text'
          ? { ...l, x: l.x * ratioX, y: l.y * ratioY, width: l.width * ratioX, fontSize: l.fontSize * ((ratioX + ratioY) / 2) }
          : { ...l, x: l.x * ratioX, y: l.y * ratioY, width: l.width * ratioX, height: l.height * ratioY },
      ),
    );
    prevSize.current = next;
    setSizeMm(next);
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

  function handleBackgroundImage(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      setBackground((b) => ({ ...b, imageSrc: reader.result as string }));
    };
    reader.readAsDataURL(file);
  }

  const bgImage = useHtmlImage(background.imageSrc);

  function exportPng() {
    const stage = stageRef.current;
    if (!stage) return;
    const wasSelected = selectedId;
    setSelectedId(null);
    requestAnimationFrame(() => {
      const pixelRatio = TARGET_DPI / 25.4 / PX_PER_MM;
      const dataUrl = stage.toDataURL({ pixelRatio, mimeType: 'image/png' });
      const link = document.createElement('a');
      link.download = `${product.id}-${face.id}-${sizeMm.w}x${sizeMm.h}.png`;
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

  const clipFn = useMemo(() => clipForShape(product.shape, w, h, product.cornerRadiusF), [product.shape, w, h, product.cornerRadiusF]);

  return (
    <div className="editor">
      <div className="toolbar">
        <button className="ghost" onClick={onBack}>
          ← Носители
        </button>
        <div className="toolbar-title">{product.name}</div>

        {product.faces.length > 1 && (
          <div className="face-tabs">
            {product.faces.map((f, i) => (
              <button key={f.id} className={i === faceIndex ? 'active' : ''} onClick={() => setFaceIndex(i)}>
                {f.label}
              </button>
            ))}
          </div>
        )}

        {product.resizableCanvas && (
          <div className="size-inputs">
            <label>
              Ш
              <input
                type="number"
                min={20}
                max={400}
                value={sizeMm.w}
                onChange={(e) => applySizeChange({ ...sizeMm, w: Number(e.target.value) || sizeMm.w })}
              />
            </label>
            <label>
              В
              <input
                type="number"
                min={20}
                max={400}
                value={sizeMm.h}
                onChange={(e) => applySizeChange({ ...sizeMm, h: Number(e.target.value) || sizeMm.h })}
              />
            </label>
            мм
          </div>
        )}

        <label className="field">
          <span>Фон</span>
          <input
            type="color"
            value={background.color}
            onChange={(e) => setBackground((b) => ({ ...b, color: e.target.value, imageSrc: null }))}
          />
        </label>

        <label className="upload-btn">
          Фон-изображение
          <input
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && handleBackgroundImage(e.target.files[0])}
          />
        </label>
        {background.imageSrc && (
          <button className="ghost" onClick={() => setBackground((b) => ({ ...b, imageSrc: null }))}>
            Убрать фон-фото
          </button>
        )}

        <button className="primary" onClick={exportPng}>
          Скачать PNG
        </button>
      </div>

      <div className="workspace">
        <div className="canvas-wrap" ref={containerRef}>
          <Stage
            ref={stageRef}
            width={w}
            height={h}
            onMouseDown={(e) => {
              if (e.target === e.target.getStage()) setSelectedId(null);
            }}
          >
            <KonvaLayer clipFunc={clipFn}>
              {background.imageSrc && bgImage ? (
                <KonvaImage image={bgImage} x={0} y={0} width={w} height={h} />
              ) : product.shape === 'circle' ? (
                <Circle x={w / 2} y={h / 2} radius={Math.min(w, h) / 2} fill={background.color} />
              ) : (
                <Rect x={0} y={0} width={w} height={h} fill={background.color} />
              )}

              {face.decorations === 'rings' && <RingsDecoration w={w} h={h} />}
              {face.decorations === 'divider' && (
                <Rect x={w * 0.33} y={h * 0.5} width={w * 0.34} height={1} fill="rgba(0,0,0,0.25)" listening={false} />
              )}

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

              {product.accentBorder && (
                <Rect
                  x={1}
                  y={1}
                  width={w - 2}
                  height={h - 2}
                  stroke={product.accentBorder}
                  strokeWidth={3}
                  cornerRadius={(product.cornerRadiusF ?? 0) * Math.min(w, h)}
                  listening={false}
                />
              )}

              <Transformer
                ref={transformerRef}
                rotateEnabled
                boundBoxFunc={(oldBox, newBox) => (newBox.width < 12 || newBox.height < 12 ? oldBox : newBox)}
              />
            </KonvaLayer>
          </Stage>

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
                  min={8}
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
                  backing: 'none',
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
