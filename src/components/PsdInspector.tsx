import { Eye, EyeOff, Folder, Image as ImageIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatBytes } from '../lib/format';
import { compositeOrder, describePsdError, parsePsd } from '../lib/psd';
import type { LayerOverrides, ParsedPsd, PsdLayer } from '../lib/psd';
import { drawComposite } from '../lib/psdDraw';
import type { LayerBitmapCache } from '../lib/psdDraw';
import { Scrubber } from './Scrubber';

/** Above this size, ask before parsing: it happens on the main thread. */
export const PSD_WARN_BYTES = 100 * 1024 * 1024;

export interface PsdInspectorProps {
  data: ArrayBuffer;
  onError(message: string): void;
  /** Percent; scales the preview. */
  zoom?: number;
}

interface Row {
  layer: PsdLayer;
  level: number;
  /** False when a parent group is hidden. */
  shown: boolean;
}

/** Flattens the tree for display: top-most layer first, as Photoshop lists them. */
function toRows(layers: PsdLayer[], overrides: LayerOverrides, level = 1, parentShown = true): Row[] {
  const rows: Row[] = [];
  for (const layer of [...layers].reverse()) {
    const visible = overrides[layer.id]?.visible ?? layer.visible;
    rows.push({ layer, level, shown: parentShown });
    if (layer.kind === 'group') rows.push(...toRows(layer.children, overrides, level + 1, parentShown && visible));
  }
  return rows;
}

function countLayers(layers: PsdLayer[]): number {
  return layers.reduce((total, layer) => total + 1 + countLayers(layer.children), 0);
}

export function PsdInspector({ data, onError, zoom = 100 }: PsdInspectorProps) {
  const [confirmed, setConfirmed] = useState(data.byteLength <= PSD_WARN_BYTES);
  const [parsed, setParsed] = useState<ParsedPsd | null>(null);
  const [overrides, setOverrides] = useState<LayerOverrides>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cache = useRef<LayerBitmapCache>(new Map());
  const latestOnError = useRef(onError);
  latestOnError.current = onError;

  // A new file starts from a clean slate.
  useEffect(() => {
    setConfirmed(data.byteLength <= PSD_WARN_BYTES);
    setParsed(null);
    setOverrides({});
    setSelectedId(null);
    cache.current = new Map();
  }, [data]);

  // Parse after the "Parsing…" message has had a chance to paint.
  useEffect(() => {
    if (!confirmed) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      try {
        const result = parsePsd(data);
        if (!cancelled) setParsed(result);
      } catch (error) {
        if (!cancelled) latestOnError.current(describePsdError(error));
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [data, confirmed]);

  // Repaint whenever the layers or the reader's changes to them change.
  useEffect(() => {
    if (!parsed || !canvasRef.current) return;
    const items = compositeOrder(parsed.layers, overrides);
    drawComposite(canvasRef.current, { width: parsed.width, height: parsed.height }, items, cache.current);
  }, [parsed, overrides]);

  const rows = useMemo(() => (parsed ? toRows(parsed.layers, overrides) : []), [parsed, overrides]);

  const patch = (id: string, change: { visible?: boolean; opacity?: number }) =>
    setOverrides((current) => ({ ...current, [id]: { ...current[id], ...change } }));

  if (!confirmed) {
    return (
      <div className="mx-auto flex max-w-[60ch] flex-col items-start gap-3 text-sm">
        <p className="text-ink">This PSD is {formatBytes(data.byteLength)}. Parsing may be slow.</p>
        <p className="text-muted">The page can stop responding for a while as the layers are decoded.</p>
        <button
          type="button"
          onClick={() => setConfirmed(true)}
          className="motion-color rounded border border-line px-3 py-1.5 text-xs text-ink outline-none hover:bg-surface focus-visible:ring-1 focus-visible:ring-accent"
        >
          Open anyway
        </button>
      </div>
    );
  }

  if (!parsed) {
    return <p className="mx-auto max-w-[60ch] text-sm text-muted">Parsing…</p>;
  }

  const total = countLayers(parsed.layers);

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1 overflow-auto">
        <canvas
          ref={canvasRef}
          aria-label="Composite preview"
          className="block max-w-none border border-line bg-surface"
          style={{ width: `${(parsed.width * zoom) / 100}px`, maxWidth: zoom === 100 ? '100%' : undefined }}
        />
      </div>

      <section aria-label="Layers" className="w-full shrink-0 border border-line bg-surface lg:w-80">
        <div className="flex items-baseline justify-between border-b border-line px-3 py-2">
          <h2 className="text-[10px] font-medium uppercase tracking-wider text-muted">Layers</h2>
          <span className="font-mono text-[10px] tabular-nums text-muted">
            <span>
              {parsed.width} × {parsed.height} px
            </span>
            {' · '}
            <span>
              {total} {total === 1 ? 'layer' : 'layers'}
            </span>
          </span>
        </div>

        <ul role="tree" aria-label="Layer tree" className="max-h-[70vh] overflow-y-auto p-1">
          {rows.map(({ layer, level, shown }) => {
            const visible = overrides[layer.id]?.visible ?? layer.visible;
            const opacity = overrides[layer.id]?.opacity ?? layer.opacity;
            const selected = layer.id === selectedId;
            const dimmed = !shown || !visible;
            return (
              <li
                key={layer.id}
                role="treeitem"
                aria-level={level}
                aria-selected={selected}
                data-layer-name={layer.name}
                className={`rounded ${selected ? 'bg-active' : ''}`}
              >
                <div className="flex items-center gap-1" style={{ paddingLeft: `${(level - 1) * 16}px` }}>
                  <button
                    type="button"
                    aria-label={`Toggle ${layer.name}`}
                    aria-pressed={visible}
                    title={visible ? 'Hide layer' : 'Show layer'}
                    onClick={() => patch(layer.id, { visible: !visible })}
                    className={`motion-color flex h-7 w-7 shrink-0 items-center justify-center rounded outline-none focus-visible:ring-1 focus-visible:ring-accent ${
                      visible ? 'text-ink' : 'text-muted'
                    }`}
                  >
                    {visible ? <Eye size={14} strokeWidth={1.75} /> : <EyeOff size={14} strokeWidth={1.75} />}
                  </button>
                  <button
                    type="button"
                    aria-label={`Select ${layer.name}`}
                    onClick={() => setSelectedId(selected ? null : layer.id)}
                    className={`motion-color flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-1.5 text-left text-xs outline-none focus-visible:ring-1 focus-visible:ring-accent ${
                      dimmed ? 'text-muted' : 'text-ink'
                    }`}
                  >
                    <span className="shrink-0 text-muted">
                      {layer.kind === 'group' ? (
                        <Folder size={12} strokeWidth={1.75} />
                      ) : (
                        <ImageIcon size={12} strokeWidth={1.75} />
                      )}
                    </span>
                    <span className={`min-w-0 flex-1 truncate ${visible ? '' : 'line-through'}`}>{layer.name}</span>
                    {layer.blendMode !== 'normal' && layer.blendMode !== 'pass through' ? (
                      <span className="shrink-0 font-mono text-[10px] text-muted">{layer.blendMode}</span>
                    ) : null}
                    <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted">{opacity}%</span>
                  </button>
                </div>
                {selected ? (
                  <div className="px-3 pb-2 pt-1" style={{ paddingLeft: `${(level - 1) * 16 + 12}px` }}>
                    <Scrubber
                      label={`Opacity of ${layer.name}`}
                      value={opacity}
                      min={0}
                      max={100}
                      step={1}
                      format={(v) => `${v}%`}
                      onChange={(value) => patch(layer.id, { opacity: value })}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
