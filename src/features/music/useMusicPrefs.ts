import { useCallback, useEffect, useState } from 'react';
import type { PlaylistItem, SourceId } from './adapter';
import { CATEGORIES } from './playlists';
import { getPref, setPref } from '../../shared/prefs';

const SOURCES: SourceId[] = ['noise', 'spotify', 'youtube', 'tracks'];

export interface MusicPrefs {
  ready: boolean;
  source: SourceId;
  category: string;
  customPlaylists: PlaylistItem[];
  setSource(source: SourceId): void;
  setCategory(id: string): void;
  addCustom(item: PlaylistItem): void;
}

/** The music source, browse tab and pasted links, remembered between visits. */
export function useMusicPrefs(): MusicPrefs {
  const [ready, setReady] = useState(false);
  const [source, setSourceState] = useState<SourceId>('noise');
  const [category, setCategoryState] = useState<string>(CATEGORIES[0].id);
  const [customPlaylists, setCustom] = useState<PlaylistItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [savedSource, savedCategory, savedCustom] = await Promise.all([
        getPref<unknown>('musicSource', null),
        getPref<unknown>('musicCategory', null),
        getPref<unknown>('customPlaylists', []),
      ]);
      if (cancelled) return;
      if (SOURCES.includes(savedSource as SourceId)) setSourceState(savedSource as SourceId);
      if (typeof savedCategory === 'string') setCategoryState(savedCategory);
      if (Array.isArray(savedCustom)) setCustom(savedCustom as PlaylistItem[]);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setSource = useCallback((next: SourceId) => {
    setSourceState(next);
    void setPref('musicSource', next);
  }, []);

  const setCategory = useCallback((id: string) => {
    setCategoryState(id);
    void setPref('musicCategory', id);
  }, []);

  const addCustom = useCallback((item: PlaylistItem) => {
    setCustom((current) => {
      if (current.some((existing) => existing.id === item.id)) return current;
      const next = [...current, item];
      void setPref('customPlaylists', next);
      return next;
    });
  }, []);

  return { ready, source, category, customPlaylists, setSource, setCategory, addCustom };
}
