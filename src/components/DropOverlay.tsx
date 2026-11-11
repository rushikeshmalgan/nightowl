import { Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

function carriesFiles(event: DragEvent): boolean {
  const types = event.dataTransfer?.types;
  return types ? Array.from(types).includes('Files') : false;
}

/** A full-window drop target that appears while files are dragged over the page. */
export function DropOverlay({ onFiles }: { onFiles(files: File[]): void }) {
  const [active, setActive] = useState(false);
  const depth = useRef(0);
  const latest = useRef(onFiles);
  latest.current = onFiles;

  useEffect(() => {
    const onDragEnter = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      depth.current += 1;
      setActive(true);
    };
    const onDragOver = (event: DragEvent) => {
      // Required, or the browser refuses the drop.
      if (carriesFiles(event)) event.preventDefault();
    };
    const onDragLeave = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setActive(false);
    };
    const onDrop = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      depth.current = 0;
      setActive(false);
      const files = Array.from(event.dataTransfer?.files ?? []);
      if (files.length > 0) latest.current(files);
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  if (!active) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 border border-dashed border-accent/60 bg-canvas/90 text-ink"
      style={{ pointerEvents: 'none' }}
    >
      <Upload size={24} strokeWidth={1.5} className="text-accent" />
      <p className="text-sm">Drop to add to your library</p>
      <p className="font-mono text-[11px] text-muted">.pdf .psd .txt .md .json .csv</p>
    </div>
  );
}
