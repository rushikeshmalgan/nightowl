import { ChevronsDown, Library, ScanLine, Search, SlidersHorizontal, Type, Volume2 } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Chrome } from './components/Chrome';
import { CommandPalette } from './components/CommandPalette';
import { Rail } from './components/Rail';
import type { RailItem } from './components/Rail';
import { ReaderCanvas } from './components/ReaderCanvas';
import { StatusLine } from './components/StatusLine';
import { TuningPanel } from './components/TuningPanel';
import { WarmthOverlay } from './components/WarmthOverlay';
import { SEED_DOCS } from './data/seeds';
import { useHotkeys } from './hooks/useHotkeys';
import { useIdleFade } from './hooks/useIdleFade';
import { useTts } from './hooks/useTts';
import { buildCommands } from './lib/commands';
import { useUi } from './store/ui';

const ICON = { size: 16, strokeWidth: 1.75 } as const;

export default function App() {
  const ui = useUi();
  const [docIndex, setDocIndex] = useState(0);
  const doc = SEED_DOCS[docIndex] ?? null;
  const tts = useTts(doc?.text ?? '', ui.speechRate);

  // Panels the reader is actively using should not fade out from under them.
  const panelOpen = ui.paletteOpen || ui.tuningOpen || ui.libraryOpen;
  const { idle } = useIdleFade({ enabled: !panelOpen });

  const tuningOpenedByHover = useRef(false);

  useHotkeys({
    'mod+k': () => ui.toggle('paletteOpen'),
    'mod+b': () => ui.toggle('bionic'),
    '\\': () => {
      tuningOpenedByHover.current = false;
      ui.toggle('tuningOpen');
    },
    f: () => ui.toggle('focusRuler'),
    s: () => tts.toggle(),
  });

  const commands = useMemo(
    () => buildCommands({ ui: useUi.getState(), tts: { supported: tts.supported, toggle: tts.toggle } }),
    [tts.supported, tts.toggle],
  );

  const railItems: RailItem[] = [
    {
      id: 'library',
      label: 'Library',
      icon: <Library {...ICON} />,
      pressed: ui.libraryOpen,
      onClick: () => ui.toggle('libraryOpen'),
    },
    {
      id: 'palette',
      label: 'Command palette',
      icon: <Search {...ICON} />,
      hotkey: 'mod+k',
      onClick: () => ui.set('paletteOpen', true),
    },
    {
      id: 'bionic',
      label: 'Bionic reading',
      icon: <Type {...ICON} />,
      hotkey: 'mod+b',
      pressed: ui.bionic,
      onClick: () => ui.toggle('bionic'),
    },
    {
      id: 'ruler',
      label: 'Focus ruler',
      icon: <ScanLine {...ICON} />,
      hotkey: 'f',
      pressed: ui.focusRuler,
      onClick: () => ui.toggle('focusRuler'),
    },
    {
      id: 'tts',
      label: 'Read aloud',
      icon: <Volume2 {...ICON} />,
      hotkey: 's',
      pressed: tts.speaking,
      disabled: !tts.supported,
      disabledReason: 'Read aloud is not supported in this browser',
      onClick: () => tts.toggle(),
    },
    {
      id: 'autoscroll',
      label: 'Auto-scroll',
      icon: <ChevronsDown {...ICON} />,
      pressed: ui.autoScroll,
      onClick: () => ui.toggle('autoScroll'),
    },
    {
      id: 'tuning',
      label: 'Tuning',
      icon: <SlidersHorizontal {...ICON} />,
      hotkey: '\\',
      pressed: ui.tuningOpen,
      onClick: () => {
        tuningOpenedByHover.current = false;
        ui.toggle('tuningOpen');
      },
    },
  ];

  const flags = [
    ui.bionic ? 'Bionic' : null,
    ui.focusRuler ? 'Ruler' : null,
    ui.autoScroll ? 'Auto-scroll' : null,
    tts.speaking ? 'Reading aloud' : null,
  ].filter((flag): flag is string => flag !== null);

  return (
    <div role="application" aria-label="Nocturne Reader" className="relative h-full overflow-hidden bg-canvas text-ink">
      <ReaderCanvas doc={doc} />

      <Chrome idle={idle}>
        <Rail items={railItems} />
        <StatusLine title={doc?.name ?? 'No document'} flags={flags} />

        {ui.libraryOpen ? (
          <div className="absolute left-12 top-8 w-64 border-b border-r border-line bg-surface p-1">
            {SEED_DOCS.map((seed, index) => (
              <button
                key={seed.name}
                type="button"
                onClick={() => {
                  setDocIndex(index);
                  ui.set('libraryOpen', false);
                }}
                className={`motion-color block w-full truncate rounded px-2 py-1.5 text-left text-xs outline-none focus-visible:ring-1 focus-visible:ring-accent ${
                  index === docIndex ? 'bg-active text-ink' : 'text-muted hover:text-ink'
                }`}
              >
                {seed.name}
              </button>
            ))}
          </div>
        ) : null}

        {/* Hovering the right edge slides the tuning panel out. */}
        <div
          aria-hidden="true"
          className="absolute bottom-0 right-0 top-8 w-2"
          onMouseEnter={() => {
            if (!ui.tuningOpen) {
              tuningOpenedByHover.current = true;
              ui.set('tuningOpen', true);
            }
          }}
        />
        <TuningPanel
          onMouseLeave={() => {
            if (tuningOpenedByHover.current) {
              tuningOpenedByHover.current = false;
              ui.set('tuningOpen', false);
            }
          }}
        />
      </Chrome>

      <CommandPalette open={ui.paletteOpen} onOpenChange={(open) => ui.set('paletteOpen', open)} commands={commands} />
      <WarmthOverlay />
    </div>
  );
}
