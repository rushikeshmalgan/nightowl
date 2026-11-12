export type DocType = 'pdf' | 'psd' | 'text';
export type ThemeId = 'night' | 'sepia' | 'oled' | 'crimson';
export type LanguageTag = 'EN' | 'HI' | 'INST' | 'NATURE';

export interface DocRecord {
  id: string;
  name: string;
  type: DocType;
  size: number;
  blob: Blob;
  addedAt: number;
  lastOpenedAt: number;
}

export type DocMeta = Omit<DocRecord, 'blob'>;

export interface ThumbnailRecord {
  docId: string;
  page: number;
  blob: Blob;
}

export interface ProgressRecord {
  docId: string;
  page: number;
  scrollTop: number;
}

export interface BookmarkRecord {
  id: string;
  docId: string;
  page: number;
  label: string;
  createdAt: number;
}

export interface HighlightRecord {
  id: string;
  docId: string;
  start: number;
  end: number;
  note: string;
  createdAt: number;
}

export interface TrackRecord {
  id: string;
  title: string;
  artist: string;
  language: LanguageTag | null;
  duration: number;
  blob?: Blob;
  url?: string;
  addedAt: number;
}

export interface PrefRecord {
  key: string;
  value: unknown;
}
