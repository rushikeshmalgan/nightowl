import { RotateCcw } from 'lucide-react';
import { NARROW_QUERY, useMediaQuery } from '../../shared/useMediaQuery';
import { KELVIN_MAX, KELVIN_MIN } from './warmth';
import { useUi, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from './ui';
import type { ThemeId } from '../../shared/types';
import { Scrubber } from '../../shared/Scrubber';
import { SHEET_LAYOUT } from './sheet';
import { SheetHandle } from './SheetHandle';

const THEMES: Array<{ id: ThemeId; label: string }> = [
  { id: 'night', label: 'Night' },
  { id: 'sepia', label: 'Sepia' },
  { id: 'oled', label: 'OLED' },
  { id: 'crimson', label: 'Crimson' },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b border-line px-4 py-4">
      <h2 className="text-[10px] font-medium uppercase tracking-wider text-muted">{title}</h2>
      {children}
    </section>
  );
}

function Toggle({ label, pressed, onClick }: { label: string; pressed: boolean; onClick(): void }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`motion-color flex items-center justify-between rounded border border-line px-2 py-1.5 text-xs outline-none focus-visible:ring-1 focus-visible:ring-accent ${
        pressed ? 'bg-active text-ink' : 'text-muted hover:text-ink'
      }`}
    >
      <span>{label}</span>
      <span className="font-mono text-[10px]">{pressed ? 'ON' : 'OFF'}</span>
    </button>
  );
}

/** The slide-out panel of reading controls on the right edge. */
export function TuningPanel({ onMouseLeave }: { onMouseLeave?: () => void }) {
  const ui = useUi();
  const open = ui.tuningOpen;
  const narrow = useMediaQuery(NARROW_QUERY);
  // Closed, it waits off the right edge on a wide screen and below the bottom edge on a phone.
  const offscreen = narrow ? 'translateY(100%)' : 'translateX(100%)';

  return (
    <aside
      role="complementary"
      aria-label="Tuning"
      data-open={open}
      inert={!open}
      onMouseLeave={onMouseLeave}
      className={`motion-slide absolute bottom-0 right-0 top-8 flex w-72 flex-col overflow-y-auto border-l border-line bg-surface ${SHEET_LAYOUT}`}
      style={{ transform: open ? 'none' : offscreen }}
    >
      <SheetHandle onClose={() => ui.set('tuningOpen', false)} />
      <Section title="Theme">
        <div className="grid grid-cols-4 gap-1">
          {THEMES.map((theme) => (
            <button
              key={theme.id}
              type="button"
              aria-pressed={ui.theme === theme.id}
              onClick={() => ui.set('theme', theme.id)}
              className={`motion-color rounded border border-line px-1 py-1.5 text-[11px] outline-none focus-visible:ring-1 focus-visible:ring-accent ${
                ui.theme === theme.id ? 'bg-active text-ink' : 'text-muted hover:text-ink'
              }`}
            >
              {theme.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Light">
        <Scrubber
          label="Warmth"
          value={ui.warmthK}
          min={KELVIN_MIN}
          max={KELVIN_MAX}
          step={100}
          format={(v) => `${v}K`}
          onChange={(v) => ui.set('warmthK', v)}
        />
        <Scrubber
          label="Brightness"
          value={ui.brightness}
          min={30}
          max={120}
          step={1}
          format={(v) => `${v}%`}
          onChange={(v) => ui.set('brightness', v)}
        />
        <Scrubber
          label="Contrast"
          value={ui.contrast}
          min={70}
          max={150}
          step={1}
          format={(v) => `${v}%`}
          onChange={(v) => ui.set('contrast', v)}
        />
        <Toggle label="Night pages (PDF)" pressed={ui.nightPages} onClick={() => ui.toggle('nightPages')} />
      </Section>

      <Section title="Type">
        <Scrubber
          label="Font size"
          value={ui.fontSize}
          min={12}
          max={32}
          step={1}
          format={(v) => `${v}px`}
          onChange={(v) => ui.set('fontSize', v)}
        />
        <Scrubber
          label="Line spacing"
          value={ui.lineHeight}
          min={1.2}
          max={2.5}
          step={0.1}
          format={(v) => `${v.toFixed(1)}x`}
          onChange={(v) => ui.set('lineHeight', v)}
        />
        <Scrubber
          label="Zoom"
          value={ui.zoom}
          min={ZOOM_MIN}
          max={ZOOM_MAX}
          step={ZOOM_STEP}
          format={(v) => `${v}%`}
          onChange={(v) => ui.set('zoom', v)}
        />
        <Toggle label="Dyslexia-friendly font" pressed={ui.dyslexic} onClick={() => ui.toggle('dyslexic')} />
      </Section>

      <Section title="Pace">
        <Scrubber
          label="Scroll speed"
          value={ui.scrollSpeed}
          min={0.25}
          max={3}
          step={0.05}
          format={(v) => `${v.toFixed(2)}x`}
          onChange={(v) => ui.set('scrollSpeed', v)}
        />
        <Scrubber
          label="Speech rate"
          value={ui.speechRate}
          min={0.5}
          max={2}
          step={0.05}
          format={(v) => `${v.toFixed(2)}x`}
          onChange={(v) => ui.set('speechRate', v)}
        />
        <Toggle label="Auto-scroll" pressed={ui.autoScroll} onClick={() => ui.toggle('autoScroll')} />
      </Section>

      <div className="px-4 py-4">
        <button
          type="button"
          onClick={() => {
            const keepOpen = ui.tuningOpen;
            ui.reset();
            ui.set('tuningOpen', keepOpen);
          }}
          className="motion-color flex w-full items-center justify-center gap-2 rounded border border-line px-2 py-1.5 text-xs text-muted outline-none hover:text-ink focus-visible:ring-1 focus-visible:ring-accent"
        >
          <RotateCcw size={12} strokeWidth={1.75} />
          Reset settings
        </button>
      </div>
    </aside>
  );
}
