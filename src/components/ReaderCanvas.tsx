import { useRef, useState } from 'react';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { useHotkeys } from '../hooks/useHotkeys';
import { useUi } from '../store/ui';
import { FocusRuler } from './FocusRuler';
import { TextView } from './TextView';

const RULER_STEP = 24;

/** Code-like text reads better in a monospace face. */
function isCodeLike(name: string): boolean {
  return /\.(json|csv)$/i.test(name);
}

export function ReaderCanvas({ doc }: { doc: { name: string; text: string } | null }) {
  const bionic = useUi((s) => s.bionic);
  const dyslexic = useUi((s) => s.dyslexic);
  const fontSize = useUi((s) => s.fontSize);
  const lineHeight = useUi((s) => s.lineHeight);
  const zoom = useUi((s) => s.zoom);
  const brightness = useUi((s) => s.brightness);
  const contrast = useUi((s) => s.contrast);
  const focusRuler = useUi((s) => s.focusRuler);
  const autoScroll = useUi((s) => s.autoScroll);
  const scrollSpeed = useUi((s) => s.scrollSpeed);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [rulerY, setRulerY] = useState(250);

  useAutoScroll(scrollRef, autoScroll, scrollSpeed);

  // The arrow keys move the ruler only while it is on; otherwise they keep
  // their normal scrolling behaviour.
  useHotkeys(
    focusRuler
      ? {
          ArrowUp: () => setRulerY((y) => Math.max(0, y - RULER_STEP)),
          ArrowDown: () => setRulerY((y) => y + RULER_STEP),
        }
      : {},
  );

  return (
    <main
      className="absolute inset-0"
      onMouseMove={(event) => {
        if (!focusRuler) return;
        const rect = event.currentTarget.getBoundingClientRect();
        setRulerY(event.clientY - rect.top);
      }}
    >
      <div
        ref={scrollRef}
        data-testid="reader-scroll"
        className="h-full overflow-y-auto pl-12 pt-8"
        style={{ filter: `brightness(${brightness}%) contrast(${contrast}%)` }}
      >
        <div className="px-6 py-12 md:px-12">
          {doc ? (
            <TextView
              text={doc.text}
              mono={isCodeLike(doc.name)}
              bionic={bionic}
              dyslexic={dyslexic}
              fontSize={Math.round((fontSize * zoom) / 100)}
              lineHeight={lineHeight}
            />
          ) : (
            <p className="mx-auto max-w-[72ch] text-sm text-muted">
              Nothing is open. Drop a file here, or press Ctrl K to find a document.
            </p>
          )}
        </div>
      </div>
      {focusRuler ? <FocusRuler y={rulerY} /> : null}
    </main>
  );
}
