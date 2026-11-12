import * as scripts from './loadScript';
import { createYouTubeAdapter, NO_PLAYABLE_ERROR } from './youtube';
import type { YTNamespace } from './youtube';

vi.mock('./loadScript', () => ({ loadScript: vi.fn(async () => {}) }));

type Events = { onReady?: () => void; onStateChange?: (e: { data: number }) => void; onError?: (e: { data: number }) => void };

class FakePlayer {
  static last: FakePlayer;
  events: Events;
  options: Record<string, unknown>;
  time = 0;
  video = { video_id: 'vid1', title: 'Song One', author: 'Channel A' };
  playVideo = vi.fn();
  pauseVideo = vi.fn();
  seekTo = vi.fn();
  setVolume = vi.fn();
  nextVideo = vi.fn();
  previousVideo = vi.fn();
  loadPlaylist = vi.fn();
  loadVideoById = vi.fn();
  destroy = vi.fn();
  getCurrentTime = () => this.time;
  getDuration = () => 240;
  getVideoData = () => this.video;
  constructor(_el: HTMLElement, options: Record<string, unknown>) {
    this.options = options;
    this.events = options.events as Events;
    FakePlayer.last = this;
  }
}

const fakeYT = { Player: FakePlayer as unknown as YTNamespace['Player'] } as YTNamespace;
const playlist = { id: 'p', source: 'youtube' as const, ref: 'PL123', title: 'Night', artist: 'Curator', language: 'HI' as const, kind: 'playlist' as const };

async function loaded() {
  const loadYT = vi.fn(async () => fakeYT);
  const adapter = createYouTubeAdapter({ loadYT });
  adapter.mount(document.createElement('div'));
  FakePlayer.last = undefined as unknown as FakePlayer;
  const loading = adapter.load(playlist);
  // The player is created after the API script loads; then YouTube calls onReady.
  await vi.waitFor(() => expect(FakePlayer.last).toBeDefined());
  FakePlayer.last.events.onReady?.();
  await loading;
  return { adapter, loadYT, player: FakePlayer.last };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('createYouTubeAdapter', () => {
  it('touches no network until something is loaded', () => {
    const loadYT = vi.fn(async () => fakeYT);
    createYouTubeAdapter({ loadYT });
    expect(loadYT).not.toHaveBeenCalled();
    createYouTubeAdapter();
    expect(scripts.loadScript).not.toHaveBeenCalled();
  });

  it('creates a privacy-enhanced 200x200 player with no YouTube controls', async () => {
    const { player, loadYT } = await loaded();
    expect(loadYT).toHaveBeenCalledTimes(1);
    expect(player.options).toMatchObject({ host: 'https://www.youtube-nocookie.com', width: 200, height: 200 });
    expect(player.options.playerVars).toMatchObject({ controls: 0, playsinline: 1, rel: 0, enablejsapi: 1, listType: 'playlist', list: 'PL123' });
  });

  it('loads the IFrame API script from YouTube by default', async () => {
    const adapter = createYouTubeAdapter();
    void adapter.load(playlist).catch(() => {});
    await vi.waitFor(() => expect(scripts.loadScript).toHaveBeenCalledWith('https://www.youtube.com/iframe_api'));
  });

  it('reuses the player for the next item', async () => {
    const { adapter, player } = await loaded();
    await adapter.load({ ...playlist, ref: 'vidX', kind: 'video' });
    expect(player.loadVideoById).toHaveBeenCalledWith('vidX');
    await adapter.load({ ...playlist, ref: 'PL9' });
    expect(player.loadPlaylist).toHaveBeenCalledWith({ list: 'PL9', listType: 'playlist' });
  });

  it('plays, pauses and tracks the playing state', async () => {
    const { adapter, player } = await loaded();
    await adapter.play();
    expect(player.playVideo).toHaveBeenCalled();
    player.events.onStateChange?.({ data: 1 });
    expect(adapter.getState().isPlaying).toBe(true);
    adapter.pause();
    expect(player.pauseVideo).toHaveBeenCalled();
    player.events.onStateChange?.({ data: 2 });
    expect(adapter.getState().isPlaying).toBe(false);
  });

  it('shows the current video title, channel and thumbnail', async () => {
    const { adapter, player } = await loaded();
    player.events.onStateChange?.({ data: 1 });
    expect(adapter.getState()).toMatchObject({
      title: 'Song One',
      artist: 'Channel A',
      artUrl: 'https://i.ytimg.com/vi/vid1/hqdefault.jpg',
      language: 'HI',
      duration: 240,
      canSeek: true,
      canSetVolume: true,
      canSkip: true,
    });
  });

  it('polls the position every 500 ms while playing', async () => {
    vi.useFakeTimers();
    const { adapter, player } = await loaded();
    player.events.onStateChange?.({ data: 1 });
    player.time = 12.5;
    vi.advanceTimersByTime(500);
    expect(adapter.getState().position).toBe(12.5);
    player.events.onStateChange?.({ data: 2 });
    player.time = 99;
    vi.advanceTimersByTime(2000);
    expect(adapter.getState().position).toBe(12.5);
  });

  it('maps volume and seeking to the player', async () => {
    const { adapter, player } = await loaded();
    adapter.setVolume(0.5);
    expect(player.setVolume).toHaveBeenCalledWith(50);
    expect(adapter.getState().volume).toBe(0.5);
    adapter.seek(30);
    expect(player.seekTo).toHaveBeenCalledWith(30, true);
    adapter.next();
    adapter.previous();
    expect(player.nextVideo).toHaveBeenCalledTimes(1);
    expect(player.previousVideo).toHaveBeenCalledTimes(1);
  });

  it('skips an unplayable video, and gives up after three in a row', async () => {
    const { adapter, player } = await loaded();
    player.events.onError?.({ data: 150 });
    expect(player.nextVideo).toHaveBeenCalledTimes(1);
    expect(adapter.getState().error).toBeNull();
    player.events.onError?.({ data: 101 });
    player.events.onError?.({ data: 150 });
    expect(adapter.getState().error).toBe(NO_PLAYABLE_ERROR);
    expect(NO_PLAYABLE_ERROR).toBe('No playable videos in this playlist.');
  });

  it('forgets earlier errors once a video plays', async () => {
    const { adapter, player } = await loaded();
    player.events.onError?.({ data: 150 });
    player.events.onError?.({ data: 150 });
    player.events.onStateChange?.({ data: 1 });
    player.events.onError?.({ data: 150 });
    expect(adapter.getState().error).toBeNull();
  });

  it('reports a script that will not load', async () => {
    const adapter = createYouTubeAdapter({ loadYT: async () => Promise.reject(new Error('offline')) });
    adapter.mount(document.createElement('div'));
    await expect(adapter.load(playlist)).rejects.toThrow("YouTube didn't load.");
    expect(adapter.getState().error).toBe("YouTube didn't load.");
  });

  it('destroys the player on dispose', async () => {
    const { adapter, player } = await loaded();
    adapter.dispose();
    expect(player.destroy).toHaveBeenCalled();
  });
});
