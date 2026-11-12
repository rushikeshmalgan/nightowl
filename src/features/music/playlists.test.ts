import { CATEGORIES } from './playlists';

const TAGS = ['EN', 'HI', 'INST', 'NATURE'];
const all = CATEGORIES.flatMap((category) => category.items);

describe('CATEGORIES', () => {
  it('has the four categories by name', () => {
    expect(CATEGORIES.map((c) => c.name)).toEqual([
      'English Focus',
      'Hindi / Bollywood Chill',
      'Instrumental & Classical',
      'Nature & White Noise',
    ]);
  });

  it('gives every item an id, title and ref', () => {
    for (const entry of all) {
      expect(entry.id).not.toBe('');
      expect(entry.title).not.toBe('');
      expect(entry.ref).not.toBe('');
    }
  });

  it('uses only known language tags', () => {
    for (const entry of all) expect(entry.language === null || TAGS.includes(entry.language)).toBe(true);
  });

  it('has unique ids', () => {
    expect(new Set(all.map((entry) => entry.id)).size).toBe(all.length);
  });

  it('has at least two items per category', () => {
    for (const category of CATEGORIES) expect(category.items.length).toBeGreaterThanOrEqual(2);
  });

  it('includes the built-in noise tracks under nature', () => {
    const nature = CATEGORIES.find((c) => c.id === 'nature');
    const noise = nature?.items.filter((entry) => entry.source === 'noise').map((entry) => entry.ref);
    expect(noise).toEqual(expect.arrayContaining(['rain', 'pink']));
  });

  it('tags every Hindi item HI', () => {
    const hindi = CATEGORIES.find((c) => c.id === 'hindi-chill');
    for (const entry of hindi?.items ?? []) expect(entry.language).toBe('HI');
  });

  it('stores Spotify refs as URIs', () => {
    for (const entry of all.filter((e) => e.source === 'spotify')) expect(entry.ref).toMatch(/^spotify:playlist:[A-Za-z0-9]+$/);
  });
});
