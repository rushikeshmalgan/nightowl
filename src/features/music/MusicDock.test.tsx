import { fireEvent, render, screen, within } from '@testing-library/react';
import type { MusicSource } from './useMusicSource';
import { EMPTY_PLAYBACK } from './adapter';
import type { PlaybackState } from './adapter';
import { CATEGORIES } from './playlists';
import type { TrackRecord } from '../../shared/types';
import { MusicDock } from './MusicDock';
import { setMedia } from '../../test/media';

vi.mock('./TrackUpload', () => ({ TrackUpload: () => <div data-testid="track-upload" /> }));

function music(state: Partial<PlaybackState> = {}, overrides: Partial<MusicSource> = {}): MusicSource {
  return {
    activeSource: 'noise',
    state: { ...EMPTY_PLAYBACK, canSetVolume: true, ...state },
    loadError: null,
    select: vi.fn(async () => {}),
    play: vi.fn(async () => {}),
    pause: vi.fn(),
    toggle: vi.fn(async () => {}),
    seek: vi.fn(),
    setVolume: vi.fn(),
    next: vi.fn(),
    previous: vi.fn(),
    setSleepTimer: vi.fn(),
    sleepMinutes: 0,
    sleepRemainingMs: null,
    ...overrides,
  };
}

const tracks: TrackRecord[] = [{ id: 't1', title: 'Night Drive', artist: '', language: null, duration: 0, addedAt: 1 }];

function setup(m: MusicSource = music(), props: Partial<React.ComponentProps<typeof MusicDock>> = {}) {
  const onAddCustom = vi.fn();
  render(<MusicDock music={m} categories={CATEGORIES} tracks={tracks} customPlaylists={[]} online onAddCustom={onAddCustom} onTracksChanged={() => {}} {...props} />);
  return { m, onAddCustom };
}

const browse = () => fireEvent.click(screen.getByRole('button', { name: 'Browse music' }));

describe('MusicDock on a phone', () => {
  beforeEach(() => setMedia({ narrow: true }));

  it('keeps only what fits: title, previous, play, next and Browse; no cover or inline sleep select', () => {
    setup(music({ title: 'Lo-Fi', artist: 'NightOwl', artUrl: 'https://i.scdn.co/image/a' }));
    const dock = screen.getByRole('region', { name: 'Music' });
    expect(within(dock).getByText('Lo-Fi')).toBeInTheDocument();
    for (const name of ['Previous', 'Play', 'Next', 'Browse music']) expect(within(dock).getByRole('button', { name })).toBeInTheDocument();
    expect(within(dock).queryByRole('img')).not.toBeInTheDocument();
    expect(within(dock).queryByLabelText('Sleep timer')).not.toBeInTheDocument();
  });

  it('offers the sleep timer in the Browse panel instead', () => {
    const { m } = setup();
    browse();
    const panel = screen.getByRole('region', { name: 'Browse music' });
    fireEvent.change(within(panel).getByLabelText('Sleep timer'), { target: { value: '30' } });
    expect(m.setSleepTimer).toHaveBeenCalledWith(30);
  });

  it('still shows a running sleep countdown in the dock', () => {
    setup(music({}, { sleepMinutes: 15, sleepRemainingMs: 125_000 }));
    expect(within(screen.getByRole('region', { name: 'Music' })).getByText('2:05')).toBeInTheDocument();
  });

  it('keeps the Browse panel beside the rail, never wider than the screen allows', () => {
    setup();
    browse();
    expect(screen.getByRole('region', { name: 'Browse music' }).className).toContain('max-w-[calc(100%-3rem)]');
  });
});

describe('MusicDock source buttons', () => {
  it('appear from the lg breakpoint, so they cannot push Browse off a tablet screen', () => {
    setup();
    const group = screen.getByRole('group', { name: 'Source' });
    expect(group.className).toContain('lg:flex');
    expect(group.className).not.toContain('sm:flex');
  });
});

describe('MusicDock', () => {
  it('keeps the cover and the inline sleep select on a wide screen', () => {
    setup(music({ title: 'Lo-Fi', artUrl: 'https://i.scdn.co/image/a' }));
    const dock = screen.getByRole('region', { name: 'Music' });
    expect(within(dock).getByRole('img')).toBeInTheDocument();
    expect(within(dock).getByLabelText('Sleep timer')).toBeInTheDocument();
  });

  it('is a 56px bar showing what is playing', () => {
    setup(music({ title: 'Bollywood Acoustic', artist: 'Spotify', language: 'HI', artUrl: 'https://i.scdn.co/image/a' }));
    const dock = screen.getByRole('region', { name: 'Music' });
    expect(dock).toHaveClass('h-14');
    expect(within(dock).getByText('Bollywood Acoustic')).toBeInTheDocument();
    expect(within(dock).getByText('Spotify', { selector: 'span' })).toBeInTheDocument();
    expect(within(dock).getByText('HI')).toBeInTheDocument();
    expect(within(dock).getByRole('img')).toHaveAttribute('src', 'https://i.scdn.co/image/a');
  });

  it('labels the play button from the playing state', () => {
    const m = music({ isPlaying: false });
    setup(m);
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(m.toggle).toHaveBeenCalled();
  });

  it('shows Pause while playing', () => {
    setup(music({ isPlaying: true }));
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
  });

  it("points to Spotify's own controls instead of a play button that cannot work", () => {
    const m = music({ externalControls: true, canSetVolume: false });
    setup(m);
    const play = screen.getByRole('button', { name: 'Play' });
    expect(play).toBeDisabled();
    expect(play).toHaveAttribute('title', "Use the Spotify player's own controls.");
  });

  it('disables scrubbing when the source cannot seek', () => {
    setup(music({ canSeek: false }));
    expect(screen.getByRole('slider', { name: 'Position' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('seeks when it can', () => {
    const m = music({ canSeek: true, duration: 200, position: 10 });
    setup(m);
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Position' }), { key: 'End' });
    expect(m.seek).toHaveBeenCalledWith(200);
  });

  it('disables volume for Spotify, saying why', () => {
    setup(music({ canSetVolume: false }));
    const volume = screen.getByRole('slider', { name: 'Music volume' });
    expect(volume).toHaveAttribute('aria-disabled', 'true');
    expect(volume).toHaveAttribute('title', 'Spotify controls its own volume.');
  });

  it('switches between the four sources', () => {
    const m = music({}, { activeSource: 'youtube' });
    setup(m);
    const sources = screen.getByRole('group', { name: 'Source' });
    const buttons = within(sources).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['Night Noise', 'Spotify', 'YouTube', 'My Tracks']);
    expect(within(sources).getByRole('button', { name: 'YouTube' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(sources).getByRole('button', { name: 'Night Noise' }));
    expect(m.select).toHaveBeenCalledWith('noise');
  });

  it('greys out the online sources when offline', () => {
    setup(music(), { online: false });
    const sources = screen.getByRole('group', { name: 'Source' });
    for (const name of ['Spotify', 'YouTube']) {
      const button = within(sources).getByRole('button', { name });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('title', 'Needs a connection');
    }
    expect(within(sources).getByRole('button', { name: 'My Tracks' })).not.toBeDisabled();
  });

  it('has the four category tabs and plays a chosen item', () => {
    const m = music();
    setup(m);
    browse();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['English Focus', 'Hindi / Bollywood Chill', 'Instrumental & Classical', 'Nature & White Noise', 'My Tracks']);
    fireEvent.click(screen.getByRole('tab', { name: 'Hindi / Bollywood Chill' }));
    fireEvent.click(screen.getByRole('button', { name: /Bollywood Acoustic/ }));
    const chosen = CATEGORIES[1].items[0];
    expect(m.select).toHaveBeenCalledWith(chosen.source, chosen);
  });

  it('accepts a pasted Spotify or YouTube link', () => {
    const { onAddCustom } = setup();
    browse();
    fireEvent.change(screen.getByLabelText('Paste a Spotify or YouTube link'), { target: { value: 'https://youtu.be/abc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add link' }));
    expect(onAddCustom).toHaveBeenCalledWith(expect.objectContaining({ source: 'youtube', ref: 'abc', kind: 'video' }));
  });

  it('refuses a link it does not recognise', () => {
    const { onAddCustom } = setup();
    browse();
    fireEvent.change(screen.getByLabelText('Paste a Spotify or YouTube link'), { target: { value: 'https://evil.example/x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add link' }));
    expect(screen.getByRole('alert')).toHaveTextContent('That link is not a Spotify or YouTube link.');
    expect(onAddCustom).not.toHaveBeenCalled();
  });

  it('lists uploaded tracks with the upload form', () => {
    const m = music();
    setup(m);
    browse();
    fireEvent.click(screen.getByRole('tab', { name: 'My Tracks' }));
    expect(screen.getByTestId('track-upload')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Night Drive/ }));
    expect(m.select).toHaveBeenCalledWith('tracks', expect.objectContaining({ source: 'tracks', ref: 't1' }));
  });

  it('sets the sleep timer', () => {
    const m = music();
    setup(m);
    fireEvent.change(screen.getByLabelText('Sleep timer'), { target: { value: '30' } });
    expect(m.setSleepTimer).toHaveBeenCalledWith(30);
  });

  it('shows a source error', () => {
    setup(music({ error: 'No playable videos in this playlist.' }));
    expect(screen.getByRole('alert')).toHaveTextContent('No playable videos in this playlist.');
  });
});
