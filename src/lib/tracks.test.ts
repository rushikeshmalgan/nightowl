// @vitest-environment node
import 'fake-indexeddb/auto';
import { createDb } from './db';
import type { NightOwlDB } from './db';
import { addStreamTrack, addUploadedTrack, deleteTrack, listTracks } from './tracks';

let counter = 0;
let db: NightOwlDB;

beforeEach(() => {
  counter += 1;
  db = createDb(`tracks-test-${counter}`);
});

afterEach(async () => {
  vi.useRealTimers();
  await db.delete();
});

const audio = (name: string, bytes = 64) => new File([new Uint8Array(bytes)], name);

describe('addUploadedTrack', () => {
  it('stores an mp3 with its name as the title', async () => {
    const track = await addUploadedTrack(db, audio('Night Drive.MP3'), { duration: 183 });
    expect(track).toMatchObject({ title: 'Night Drive', artist: '', language: null, duration: 183 });
    expect(track.url).toBeUndefined();
    const stored = await db.tracks.get(track.id);
    expect(stored?.blob?.size).toBe(64);
  });

  it('accepts aac and keeps given details', async () => {
    const track = await addUploadedTrack(db, audio('raag.aac'), { title: 'Raag Yaman', artist: 'Sitar', language: 'HI' });
    expect(track).toMatchObject({ title: 'Raag Yaman', artist: 'Sitar', language: 'HI', duration: 0 });
  });

  it('refuses other formats', async () => {
    await expect(addUploadedTrack(db, audio('a.wav'))).rejects.toThrow('Only .mp3 and .aac files can be added.');
    expect(await db.tracks.count()).toBe(0);
  });

  it('refuses an empty file', async () => {
    await expect(addUploadedTrack(db, audio('empty.mp3', 0))).rejects.toThrow('File is empty.');
  });
});

describe('addStreamTrack', () => {
  it('stores an https stream with no blob', async () => {
    const track = await addStreamTrack(db, 'https://radio.example/live', { title: 'Night Radio' });
    expect(track).toMatchObject({ title: 'Night Radio', url: 'https://radio.example/live' });
    expect(track.blob).toBeUndefined();
  });

  it('refuses a plain http stream', async () => {
    await expect(addStreamTrack(db, 'http://radio.example/live', { title: 'x' })).rejects.toThrow(
      'Stream URLs must start with https://',
    );
  });

  it('names an untitled stream after its host', async () => {
    const track = await addStreamTrack(db, 'https://radio.example/live', { title: '  ' });
    expect(track.title).toBe('radio.example');
  });
});

describe('listTracks and deleteTrack', () => {
  it('lists newest first and deletes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1000);
    const first = await addUploadedTrack(db, audio('one.mp3'));
    vi.setSystemTime(2000);
    const second = await addStreamTrack(db, 'https://x.example/s', { title: 'two' });
    expect((await listTracks(db)).map((t) => t.id)).toEqual([second.id, first.id]);
    await deleteTrack(db, first.id);
    expect((await listTracks(db)).map((t) => t.id)).toEqual([second.id]);
  });
});
