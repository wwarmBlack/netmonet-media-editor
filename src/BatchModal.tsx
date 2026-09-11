import { useState } from 'react';
import type Konva from 'konva';
import type { Layer, TextLayer, ImageLayer } from './layers';
import { parseNumberRanges, padNumber, readQrSources, loadImage, type QrSource } from './batch';

const NUMBERING_RE = /^\d{1,3}$/;

// plain setTimeout, not requestAnimationFrame: rAF can pause indefinitely while the tab is
// backgrounded/minimized (very plausible mid-batch for 100+ macros), which would hang the export.
function wait(ms = 60): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function BatchModal({
  templateLayers,
  stageRef,
  pixelRatio,
  filePrefix,
  onClose,
  onApplyLayers,
  onBusyChange,
}: {
  templateLayers: Layer[];
  stageRef: React.RefObject<Konva.Stage | null>;
  pixelRatio: number;
  filePrefix: string;
  onClose: () => void;
  onApplyLayers: (layers: Layer[]) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [numbering, setNumbering] = useState('');
  const [shuffle, setShuffle] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasQrLayer = templateLayers.some((l) => l.kind === 'image' && l.label === 'QR-код');

  async function run() {
    setError(null);
    const numbers = parseNumberRanges(numbering);
    if (numbers.length === 0) {
      setError('Укажите нумерацию, например: 1-10, 15-19, 21-26');
      return;
    }
    if (files.length === 0) {
      setError('Загрузите архив с QR-кодами или один QR-код.');
      return;
    }

    setBusy(true);
    onBusyChange?.(true);
    try {
      const qrSources = await readQrSources(files);
      if (qrSources.length === 0) {
        setError('В загруженном файле не нашлось изображений QR-кодов.');
        return;
      }
      let assignedNumbers = [...numbers];
      if (shuffle) {
        for (let i = assignedNumbers.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [assignedNumbers[i], assignedNumbers[j]] = [assignedNumbers[j], assignedNumbers[i]];
        }
      }

      let pairs: { number: number; qr: QrSource }[];
      if (qrSources.length === 1 && numbers.length > 1) {
        pairs = assignedNumbers.map((number) => ({ number, qr: qrSources[0] }));
      } else if (qrSources.length === assignedNumbers.length) {
        pairs = assignedNumbers.map((number, i) => ({ number, qr: qrSources[i] }));
      } else {
        setError(
          `Не совпадает количество: номеров — ${assignedNumbers.length}, QR-кодов — ${qrSources.length}. Либо загрузите один QR-код на все макеты, либо их количество должно совпадать с количеством номеров.`,
        );
        return;
      }

      const stage = stageRef.current;
      if (!stage) {
        setError('Не удалось получить доступ к холсту.');
        return;
      }

      const qrImageCache = new Map<string, HTMLImageElement>();
      const results: { fileName: string; dataUrl: string; number: string; qrName: string }[] = [];
      setProgress({ done: 0, total: pairs.length });

      for (let i = 0; i < pairs.length; i++) {
        const { number, qr } = pairs[i];
        if (!qrImageCache.has(qr.dataUrl)) {
          qrImageCache.set(qr.dataUrl, await loadImage(qr.dataUrl));
        }
        const label = padNumber(number, assignedNumbers);

        const modified: Layer[] = templateLayers.map((l) => {
          if (l.kind === 'image' && l.label === 'QR-код') {
            return { ...l, src: qr.dataUrl } as ImageLayer;
          }
          if (l.kind === 'text' && NUMBERING_RE.test(l.text.trim())) {
            return { ...l, text: label } as TextLayer;
          }
          return l;
        });

        onApplyLayers(modified);
        await wait(80);
        stage.batchDraw();
        await wait(40);

        const dataUrl = stage.toDataURL({ pixelRatio, mimeType: 'image/png' });
        results.push({ fileName: `${filePrefix}-${label}.png`, dataUrl, number: label, qrName: qr.name });
        setProgress({ done: i + 1, total: pairs.length });
      }

      onApplyLayers(templateLayers);

      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      for (const r of results) {
        const base64 = r.dataUrl.split(',')[1];
        zip.file(r.fileName, base64, { base64: true });
      }
      const manifest = results.map((r) => `Макет №${r.number} — QR-код: ${r.qrName}`).join('\n');
      zip.file('соответствие-номеров.txt', manifest);

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filePrefix}-partiya.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setError('Что-то пошло не так при генерации. Попробуйте ещё раз.');
    } finally {
      setBusy(false);
      onBusyChange?.(false);
      setProgress(null);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="modal">
        <h3>Пакетная генерация макетов</h3>
        {!hasQrLayer && (
          <p className="hint">В этом макете нет слоя QR-кода — картинки всё равно можно сгенерировать, но QR не будет вставлен.</p>
        )}
        <label>
          QR-коды (архив .zip или несколько файлов; можно и один — тогда он вставится во все макеты)
          <input
            type="file"
            accept=".zip,image/*"
            multiple
            disabled={busy}
            onChange={(e) => setFiles(e.target.files ? Array.from(e.target.files) : [])}
          />
        </label>
        {files.length > 0 && <p className="hint">Выбрано файлов: {files.length}</p>}

        <label>
          Нумерация (например: 1-10, 15-19, 21-26)
          <textarea
            value={numbering}
            disabled={busy}
            onChange={(e) => setNumbering(e.target.value)}
            placeholder="1-10, 15-19, 21-26"
          />
        </label>

        <label className="row">
          Присвоить номера в случайном порядке
          <input type="checkbox" checked={shuffle} disabled={busy} onChange={(e) => setShuffle(e.target.checked)} />
        </label>

        {error && <p className="error-text">{error}</p>}
        {progress && (
          <p className="hint">
            Готово {progress.done} из {progress.total}…
          </p>
        )}

        <div className="modal-actions">
          <button className="ghost" onClick={onClose} disabled={busy}>
            Отмена
          </button>
          <button className="primary" onClick={run} disabled={busy}>
            {busy ? 'Генерирую…' : 'Сгенерировать и скачать архив'}
          </button>
        </div>
      </div>
    </div>
  );
}
