import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { Stage, Layer as KonvaLayer, Rect, Circle, Text, Image as KonvaImage, Transformer } from 'react-konva';
import type Konva from 'konva';
import {
  PHRASE_WITH_MENU,
  PHRASE_WITHOUT_MENU,
  SUBPHRASE_WITH_MENU,
  SUBPHRASE_WITHOUT_MENU,
  type Product,
} from './products';
import { nextId, type Layer, type TextLayer, type ImageLayer } from './layers';
import { useHtmlImage } from './useImage';

const DISPLAY_PX_PER_MM = 4;
const TARGET_DPI = 300;
const TARGET_PX_PER_MM = TARGET_DPI / 25.4;

function buildInitialLayers(product: Product, hasMenu: boolean, w: number, h: number): Layer[] {
  const titleFontSize = Math.round(w * 0.09);
  const subFontSize = Math.round(w * 0.045);
  const layers: Layer[] = [];

  const title: TextLayer = {
    id: nextId('text'),
    kind: 'text',
    text: hasMenu ? PHRASE_WITH_MENU : PHRASE_WITHOUT_MENU,
    x: w * 0.1,
    y: h * 0.14,
    width: w * 0.8,
    fontSize: titleFontSize,
    fontStyle: 'bold',
    align: 'center',
    fill: product.defaultTextColor,
    rotation: 0,
  };
  layers.push(title);

  const sub: TextLayer = {
    id: nextId('text'),
    kind: 'text',
    text: hasMenu ? SUBPHRASE_WITH_MENU : SUBPHRASE_WITHOUT_MENU,
    x: w * 0.1,
    y: h * 0.14 + titleFontSize * 3.4,
    width: w * 0.8,
    fontSize: subFontSize,
    fontStyle: 'normal',
    align: 'center',
    fill: product.defaultTextColor,
    rotation: 0,
  };
  layers.push(sub);

  const qrSize = w * 0.42;
  const qr: ImageLayer = {
    id: nextId('qr'),
    kind: 'image',
    label: 'QR-код',
    src: null,
    x: (w - qrSize) / 2,
    y: h * 0.42,
    width: qrSize,
    height: qrSize,
    rotation: 0,
    placeholderShape: 'rect',
  };
  layers.push(qr);

  const logoSize = w * 0.22;
  const logo: ImageLayer = {
    id: nextId('logo'),
    kind: 'image',
    label: 'Логотип',
    src: null,
    x: (w - logoSize) / 2,
    y: h * 0.9 - logoSize,
    width: logoSize,
    height: logoSize * 0.4,
    rotation: 0,
    placeholderShape: 'rect',
  };
  layers.push(logo);

  return layers;
}

function clipForShape(shape: Product['shape'], w: number, h: number) {
  return (ctx: Konva.Context) => {
    if (shape === 'circle') {
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, Math.min(w, h) / 2, 0, Math.PI * 2, false);
      ctx.closePath();
      return;
    }
    const radius = Math.min(w, h) * 0.06;
    const r = Math.min(radius, w / 2, h / 2);
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

function ImagePlaceholderOrPicture({
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
  const groupProps = {
    x: layer.x,
    y: layer.y,
    rotation: layer.rotation,
    draggable: true,
    onClick: onSelect,
    onTap: onSelect,
    ref: (node: Konva.Node | null) => registerRef(layer.id, node),
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
      onChange({ x: e.target.x(), y: e.target.y() });
    },
    onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
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
    },
  };

  if (img) {
    return (
      <KonvaImage
        {...groupProps}
        image={img}
        width={layer.width}
        height={layer.height}
        stroke={isSelected ? '#ff6a00' : undefined}
        strokeWidth={isSelected ? 2 : 0}
      />
    );
  }

  return (
    <Rect
      {...groupProps}
      width={layer.width}
      height={layer.height}
      fill="rgba(255,255,255,0.35)"
      stroke={isSelected ? '#ff6a00' : 'rgba(0,0,0,0.35)'}
      strokeWidth={isSelected ? 2 : 1}
      dash={[6, 4]}
      cornerRadius={layer.placeholderShape === 'circle' ? layer.width / 2 : 6}
    />
  );
}

export default function Editor({ product, onBack }: { product: Product; onBack: () => void }) {
  const [hasMenu, setHasMenu] = useState(true);
  const [sizeIndex, setSizeIndex] = useState(0);
  const size = product.sizes[sizeIndex];
  const w = Math.round(size.widthMm * DISPLAY_PX_PER_MM);
  const h = Math.round(size.heightMm * DISPLAY_PX_PER_MM);

  const [background, setBackground] = useState<{ color: string; imageSrc: string | null }>({
    color: product.defaultBackground,
    imageSrc: null,
  });

  const [layers, setLayers] = useState<Layer[]>(() => buildInitialLayers(product, true, w, h));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<TextLayer | null>(null);

  const stageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const nodeRefs = useRef<Map<string, Konva.Node>>(new Map());
  const containerRef = useRef<HTMLDivElement | null>(null);

  const registerRef = useCallback((id: string, node: Konva.Node | null) => {
    if (node) nodeRefs.current.set(id, node);
    else nodeRefs.current.delete(id);
  }, []);

  useEffect(() => {
    setLayers(buildInitialLayers(product, hasMenu, w, h));
    setSelectedId(null);
    setBackground({ color: product.defaultBackground, imageSrc: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id, sizeIndex]);

  useEffect(() => {
    setLayers((prev) =>
      prev.map((l) => {
        if (l.kind !== 'text') return l;
        if (l.text === PHRASE_WITH_MENU || l.text === PHRASE_WITHOUT_MENU) {
          return { ...l, text: hasMenu ? PHRASE_WITH_MENU : PHRASE_WITHOUT_MENU };
        }
        if (l.text === SUBPHRASE_WITH_MENU || l.text === SUBPHRASE_WITHOUT_MENU) {
          return { ...l, text: hasMenu ? SUBPHRASE_WITH_MENU : SUBPHRASE_WITHOUT_MENU };
        }
        return l;
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMenu]);

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
      const pixelRatio = TARGET_PX_PER_MM / DISPLAY_PX_PER_MM;
      const dataUrl = stage.toDataURL({ pixelRatio, mimeType: 'image/png' });
      const link = document.createElement('a');
      link.download = `${product.id}-${hasMenu ? 's-menu' : 'bez-menu'}-${size.widthMm}x${size.heightMm}.png`;
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

  const clipFn = useMemo(() => clipForShape(product.shape, w, h), [product.shape, w, h]);

  return (
    <div className="editor">
      <div className="toolbar">
        <button className="ghost" onClick={onBack}>
          ← Носители
        </button>
        <div className="toolbar-title">{product.name}</div>

        <label className="toggle">
          <span>{hasMenu ? 'С меню' : 'Без меню'}</span>
          <input type="checkbox" checked={hasMenu} onChange={(e) => setHasMenu(e.target.checked)} />
        </label>

        {product.resizable && product.sizes.length > 1 && (
          <select value={sizeIndex} onChange={(e) => setSizeIndex(Number(e.target.value))}>
            {product.sizes.map((s, i) => (
              <option key={s.label} value={i}>
                {s.label}
              </option>
            ))}
          </select>
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

              {layers.map((layer) =>
                layer.kind === 'text' ? (
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
                ) : (
                  <ImagePlaceholderOrPicture
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
                  max={Math.round(w * 0.2)}
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
                fill: product.defaultTextColor,
                rotation: 0,
              };
              setLayers((prev) => [...prev, t]);
              setSelectedId(t.id);
            }}
          >
            + Добавить текст
          </button>
        </div>
      </div>
    </div>
  );
}
