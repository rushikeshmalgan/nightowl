import { useEffect, useRef } from 'react';
import type { YouTubeAdapter } from '../lib/music/youtube';

/**
 * The YouTube player itself. YouTube requires embedded players to stay
 * visible at 200x200 or larger, so while YouTube is the active source this
 * tile sits above the dock, outside the chrome that fades when idle.
 * When another source is active it is hidden but kept, so the player survives.
 */
export function YouTubeAudioPlayer({ adapter, active }: { adapter: YouTubeAdapter; active: boolean }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mountRef.current) adapter.mount(mountRef.current);
  }, [adapter]);

  return (
    <div
      data-testid="yt-tile"
      data-idle-exempt=""
      aria-label="YouTube player"
      hidden={!active}
      className="fixed bottom-16 left-14 z-[45] overflow-hidden rounded border border-line bg-black"
      style={{ minWidth: '200px', minHeight: '200px' }}
    >
      <div ref={mountRef} className="h-[200px] w-[200px]" />
    </div>
  );
}
