import { render, screen } from '@testing-library/react';
import type { YouTubeAdapter } from '../lib/music/youtube';
import { makeFakeAdapter } from '../test/fakeAdapter';
import { YouTubeAudioPlayer } from './YouTubeAudioPlayer';

function fakeYouTube() {
  return Object.assign(makeFakeAdapter('youtube'), { mount: vi.fn() }) as unknown as YouTubeAdapter & { mount: ReturnType<typeof vi.fn> };
}

describe('YouTubeAudioPlayer', () => {
  it('renders a visible tile of at least 200x200 that the idle fade leaves alone', () => {
    const adapter = fakeYouTube();
    render(<YouTubeAudioPlayer adapter={adapter} active />);
    const tile = screen.getByTestId('yt-tile');
    expect(tile.style.minWidth).toBe('200px');
    expect(tile.style.minHeight).toBe('200px');
    expect(tile).toHaveAttribute('data-idle-exempt');
    expect(tile.closest('[data-testid="chrome"]')).toBeNull();
  });

  it('hands its mount point to the adapter', () => {
    const adapter = fakeYouTube();
    render(<YouTubeAudioPlayer adapter={adapter} active />);
    expect(adapter.mount).toHaveBeenCalledWith(expect.any(HTMLElement));
  });

  it('keeps the mount point but hides it when inactive', () => {
    const adapter = fakeYouTube();
    const { rerender } = render(<YouTubeAudioPlayer adapter={adapter} active />);
    rerender(<YouTubeAudioPlayer adapter={adapter} active={false} />);
    expect(screen.queryByTestId('yt-tile')).not.toBeVisible();
    expect(adapter.mount).toHaveBeenCalledTimes(1);
  });
});
