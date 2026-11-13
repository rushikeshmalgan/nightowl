import Dexie from 'dexie';
import type { Table } from 'dexie';
import type {
  BookmarkRecord,
  DocRecord,
  HighlightRecord,
  PrefRecord,
  ProgressRecord,
  ThumbnailRecord,
  TrackRecord,
} from './types';

/** The app's IndexedDB database. Only hooks and `lib/` modules may touch it. */
export class NightOwlDB extends Dexie {
  documents!: Table<DocRecord, string>;
  thumbnails!: Table<ThumbnailRecord, [string, number]>;
  progress!: Table<ProgressRecord, string>;
  bookmarks!: Table<BookmarkRecord, string>;
  highlights!: Table<HighlightRecord, string>;
  tracks!: Table<TrackRecord, string>;
  prefs!: Table<PrefRecord, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      documents: 'id, lastOpenedAt',
      thumbnails: '[docId+page], docId',
      progress: 'docId',
      bookmarks: 'id, docId',
      highlights: 'id, docId',
      tracks: 'id, addedAt',
      prefs: 'key',
    });
  }
}

export function createDb(name: string): NightOwlDB {
  return new NightOwlDB(name);
}

export const db = createDb('nightowl');
