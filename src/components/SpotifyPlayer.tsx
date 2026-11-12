import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { SpotifyAdapter } from '../lib/music/spotify';
import { spotifyWebUrl } from '../lib/music/spotify';

/**
 * Spotify's embed is where the music actually plays, so it stays on screen
 * while Spotify is the active source. Hidden, but kept, otherwise.
 */
export function SpotifyPlayer({ adapter, active, itemUri }: { adapter: SpotifyAdapter; active: boolean; itemUri: string | null }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const state = useSyncExternalStore(
    (onChange) => adapter.subscribe(() => onChange()),
    () => adapter.getState(),
  );

  useEffect(() => {
    if (mountRef.current) adapter.mount(mountRef.current);
  }, [adapter]);

  return (
    <div
      data-testid="spotify-embed"
      data-idle-exempt=""
      hidden={!active}
      className="fixed bottom-16 left-14 z-[45] w-80 overflow-hidden rounded border border-line bg-surface"
    >
      <div ref={mountRef} />
      {state.error ? (
        <div className="flex items-center justify-between gap-2 p-2 text-xs">
          <span role="alert" className="text-red-400">
            {state.error}
          </span>
          {itemUri ? (
            <a href={spotifyWebUrl(itemUri)} target="_blank" rel="noopener noreferrer" className="text-accent underline">
              Open in Spotify
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
