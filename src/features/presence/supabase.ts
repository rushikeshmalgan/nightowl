import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null | undefined;

/**
 * The Supabase client for live presence, or null when the project URL and
 * anon key are not configured. Without them the app runs in local mode.
 */
export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  client = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return client;
}
