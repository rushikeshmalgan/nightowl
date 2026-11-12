import { create } from 'zustand';
import { KELVIN_DEFAULT } from './warmth';
import type { ThemeId } from '../../shared/types';

export interface UiSettings {
  theme: ThemeId;
  warmthK: number;
  brightness: number;
  contrast: number;
  fontSize: number;
  lineHeight: number;
  scrollSpeed: number;
  speechRate: number;
  zoom: number;
  bionic: boolean;
  focusRuler: boolean;
  dyslexic: boolean;
  nightPages: boolean;
  autoScroll: boolean;
}

export interface UiPanels {
  paletteOpen: boolean;
  tuningOpen: boolean;
  libraryOpen: boolean;
  audioOpen: boolean;
}

type BooleanKey = {
  [K in keyof (UiSettings & UiPanels)]: (UiSettings & UiPanels)[K] extends boolean ? K : never;
}[keyof (UiSettings & UiPanels)];

export interface UiState extends UiSettings, UiPanels {
  set<K extends keyof (UiSettings & UiPanels)>(key: K, value: (UiSettings & UiPanels)[K]): void;
  toggle(key: BooleanKey): void;
  reset(): void;
}

export const DEFAULT_SETTINGS: UiSettings = {
  theme: 'night',
  warmthK: KELVIN_DEFAULT,
  brightness: 90,
  contrast: 105,
  fontSize: 18,
  lineHeight: 1.8,
  scrollSpeed: 1,
  speechRate: 1,
  zoom: 100,
  bionic: false,
  focusRuler: false,
  dyslexic: false,
  nightPages: false,
  autoScroll: false,
};

const DEFAULT_PANELS: UiPanels = {
  paletteOpen: false,
  tuningOpen: false,
  libraryOpen: false,
  audioOpen: false,
};

function applyTheme(theme: ThemeId): void {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = theme;
  }
}

export const useUi = create<UiState>((set) => ({
  ...DEFAULT_SETTINGS,
  ...DEFAULT_PANELS,
  set: (key, value) => {
    if (key === 'theme') applyTheme(value as ThemeId);
    set({ [key]: value } as Partial<UiState>);
  },
  toggle: (key) => set((state) => ({ [key]: !state[key] }) as Partial<UiState>),
  reset: () => {
    applyTheme(DEFAULT_SETTINGS.theme);
    set({ ...DEFAULT_SETTINGS, ...DEFAULT_PANELS });
  },
}));
