import { Bookmark, ChevronsDown, Library, ScanLine, Search, SlidersHorizontal, Type, Volume2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chrome } from './components/Chrome';
import { CommandPalette } from './components/CommandPalette';
import { DropOverlay } from './components/DropOverlay';
import { LibraryPanel } from './components/LibraryPanel';
import type { HighlightItem } from './components/LibraryPanel';
import { Rail } from './components/Rail';
import type { RailItem } from './components/Rail';
import { ReaderCanvas } from './components/ReaderCanvas';
import type { ReaderHandle, ReaderPosition } from './components/ReaderCanvas';
import { StatusLine } from './components/StatusLine';
import { TuningPanel } from './components/TuningPanel';
import { WarmthOverlay } from './components/WarmthOverlay';
import { useBookmarks } from './hooks/useBookmarks';
import { useHighlights } from './hooks/useHighlights';
import { useHotkeys } from './hooks/useHotkeys';
import { useIdleFade } from './hooks/useIdleFade';
import { useLocalCache } from './hooks/useLocalCache';
import { usePrefsSync } from './hooks/usePrefsSync';
import { useTts } from './hooks/useTts';
import { buildCommands, pageCommands } from './lib/commands';
import { useUi } from './store/ui';
import type { BookmarkRecord, DocMeta, DocRecord } from './types';

const ICON = { size: 16, strokeWidth: 1.75 } as const;
const MISSING_DOC = 'This document is no longer in the library.';

export default function App() {
  const ui = useUi();
  usePrefsSync();
  const cache = useLocalCache();

  const [doc, setDoc] = useState<DocRecord | null>(null);
  const [docText, setDocText] = useState('');
  const [position, setPosition] = useState<ReaderPosition | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const readerRef = useRef<ReaderHandle>(null);
  const bookmarks = useBookmarks(doc?.id ?? null);
  const highlights = useHighlights(doc?.type === 'text' ? doc.id : null);
  const highlightItems = useMemo<HighlightItem[]>(
    () =>
      highlights.highlights.map((highlight) => ({
        ...highlight,
        excerpt: docText.slice(highlight.start, highlight.end).replace(/\s+/g, ' ').trim().slice(0, 80),
      })),
    [highlights.highlights, docText],
  );
  const tts = useTts(docText, ui.speechRate);

  const { open: openFromCache, importFile, remove: removeFromCache, clearAll, refresh } = cache;

  const openDoc = useCallback(
    async (id: string): Promise<boolean> => {
      const record = await openFromCache(id);
      if (!record) {
        setNotice(MISSING_DOC);
        useUi.getState().set('libraryOpen', true);
        return false;
      }
      setNotice(null);
      setPosition(null);
      setDoc(record);
      return true;
    },
    [openFromCache],
  );

  // On first load, reopen whatever was read most recently.
  const openedInitial = useRef(false);
  useEffect(() => {
    if (!cache.ready || openedInitial.current) return;
    openedInitial.current = true;
    const first = cache.documents[0];
    if (first) void openDoc(first.id);
  }, [cache.ready, cache.documents, openDoc]);

  const importFiles = useCallback(
    async (files: File[]) => {
      let lastAdded: DocMeta | null = null;
      const problems: string[] = [];
      for (const file of files) {
        const result = await importFile(file);
        if (result.ok) lastAdded = result.doc;
        else problems.push(`${file.name}: ${result.error}`);
      }
      if (lastAdded) await openDoc(lastAdded.id);
      if (problems.length > 0) {
        setNotice(problems.join(' '));
        useUi.getState().set('libraryOpen', true);
      }
    },
    [importFile, openDoc],
  );

  const removeDoc = useCallback(
    async (id: string) => {
      await removeFromCache(id);
      if (doc?.id !== id) return;
      setDoc(null);
      setDocText('');
      setPosition(null);
      const remaining = await refresh();
      if (remaining[0]) await openDoc(remaining[0].id);
    },
    [removeFromCache, refresh, openDoc, doc?.id],
  );

  const clearEverything = useCallback(async () => {
    await clearAll(true);
    setConfirmClear(false);
    setDoc(null);
    setDocText('');
    setPosition(null);
    setNotice(null);
  }, [clearAll]);

  const requestClear = useCallback(() => {
    setConfirmClear(true);
    useUi.getState().set('libraryOpen', true);
  }, []);

  const jumpToBookmark = useCallback((bookmark: BookmarkRecord) => {
    readerRef.current?.goToPage(bookmark.page);
    useUi.getState().set('libraryOpen', false);
  }, []);

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
    () =>
      buildCommands({
        ui: useUi.getState(),
        tts: { supported: tts.supported, toggle: tts.toggle },
        documents: cache.documents,
        openDocument: (id) => void openDoc(id),
        requestClear,
      }),
    [tts.supported, tts.toggle, cache.documents, openDoc, requestClear],
  );

  // Typing a page number in the palette offers a jump to that page.
  const numPages = position?.numPages ?? null;
  const dynamicCommands = useCallback(
    (query: string) => pageCommands(query, numPages, (page) => readerRef.current?.goToPage(page)),
    [numPages],
  );

  const railItems: RailItem[] = [
    {
      id: 'library',
      label: 'Library',
      icon: <Library {...ICON} />,
      pressed: ui.libraryOpen,
      onClick: () => {
        setConfirmClear(false);
        ui.toggle('libraryOpen');
      },
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

  const page = position?.page ?? 1;

  return (
    <div role="application" aria-label="NightOwl Reader" className="relative h-full overflow-hidden bg-canvas text-ink">
      <ReaderCanvas
        ref={readerRef}
        doc={doc}
        highlights={highlights.highlights}
        onHighlight={(range) => void highlights.add(range)}
        onText={setDocText}
        onPosition={setPosition}
        onOpenLibrary={() => ui.set('libraryOpen', true)}
      />

      <Chrome idle={idle}>
        <Rail items={railItems} />
        <StatusLine title={doc?.name ?? 'No document'} flags={flags}>
          {doc && position ? (
            <span className="font-mono text-[11px] tabular-nums">
              {position.page} / {position.numPages}
            </span>
          ) : null}
          {doc ? (
            <button
              type="button"
              aria-label="Add bookmark"
              title={`Bookmark page ${page}`}
              onClick={() => void bookmarks.add(page, `Page ${page}`)}
              className="motion-color flex h-6 w-6 items-center justify-center rounded text-muted outline-none hover:text-accent focus-visible:ring-1 focus-visible:ring-accent"
            >
              <Bookmark size={14} strokeWidth={1.75} />
            </button>
          ) : null}
        </StatusLine>

        {ui.libraryOpen ? (
          <LibraryPanel
            documents={cache.documents}
            currentId={doc?.id ?? null}
            usage={cache.usage}
            overLimit={cache.overLimit}
            bookmarks={bookmarks.bookmarks}
            notice={notice}
            confirmClear={confirmClear}
            onOpen={(id) => {
              void openDoc(id).then((opened) => {
                if (opened) useUi.getState().set('libraryOpen', false);
              });
            }}
            onRemove={(id) => void removeDoc(id)}
            onImport={(files) => void importFiles(files)}
            onClearAll={() => void clearEverything()}
            onJumpToBookmark={jumpToBookmark}
            onRemoveBookmark={(id) => void bookmarks.remove(id)}
            highlights={highlightItems}
            onJumpToHighlight={(highlight) => {
              readerRef.current?.goToHighlight(highlight.start);
              useUi.getState().set('libraryOpen', false);
            }}
            onHighlightNote={(id, note) => void highlights.setNote(id, note)}
            onRemoveHighlight={(id) => void highlights.remove(id)}
          />
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

      <DropOverlay onFiles={(files) => void importFiles(files)} />
      <CommandPalette open={ui.paletteOpen} onOpenChange={(open) => ui.set('paletteOpen', open)} commands={commands} dynamic={dynamicCommands} />
      <WarmthOverlay />
    </div>
  );
}
