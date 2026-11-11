/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_AUDIO_CDN_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
