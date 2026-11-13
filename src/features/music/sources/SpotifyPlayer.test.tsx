import { render, screen } from '@testing-library/react';
import type { SpotifyAdapter } from './spotify';
import { makeFakeAdapter } from '../../../test/fakeAdapter';
import { SpotifyPlayer } from './SpotifyPlayer';

function fakeSpotify() {
  return Object.assign(makeFakeAdapter('spotify', { canSetVolume: false }), { mount: vi.fn() }) as unknown as SpotifyAdapter & {
    mount: ReturnType<typeof vi.fn>;
    emit(patch: object): void;
  };
}

describe('SpotifyPlayer', () => {
  it('gives the adapter a place for the embed', () => {
    const adapter = fakeSpotify();
    render(<SpotifyPlayer adapter={adapter} active itemUri="spotify:playlist:37i9" />);
    expect(adapter.mount).toHaveBeenCalledWith(expect.any(HTMLElement));
    expect(screen.getByTestId('spotify-embed')).toBeVisible();
  });

  it('offers to open Spotify when the embed fails', () => {
    const adapter = fakeSpotify();
    adapter.emit({ error: "Spotify didn't load." });
    render(<SpotifyPlayer adapter={adapter} active itemUri="spotify:playlist:37i9" />);
    expect(screen.getByRole('alert')).toHaveTextContent("Spotify didn't load.");
    expect(screen.getByRole('link', { name: 'Open in Spotify' })).toHaveAttribute('href', 'https://open.spotify.com/playlist/37i9');
  });

  it('is hidden when another source is active', () => {
    const adapter = fakeSpotify();
    render(<SpotifyPlayer adapter={adapter} active={false} itemUri={null} />);
    expect(screen.getByTestId('spotify-embed')).not.toBeVisible();
  });
});
