import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True when the required Vite env vars are present. */
export const isSupabaseConfigured = Boolean(url && anonKey);

function build(): SupabaseClient {
  if (!url || !anonKey) {
    // Placeholder client so that importing the module never throws. The app shows
    // the "Setup needed" screen instead of booting when this is the case.
    return createClient('https://placeholder.supabase.co', 'placeholder-anon-key', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'implicit',
    },
    realtime: { params: { eventsPerSecond: 20 } },
    global: { headers: { 'x-application-name': 'couch-clash' } },
  });
}

export const supabase: SupabaseClient = build();

/**
 * PostgREST surfaces the text after `raise exception 'x'` as the error message.
 * Normalise it to a short code so `errors.ts` can map it to friendly copy.
 */
export function rpcErrorCode(err: unknown): string {
  const message = (err as { message?: string } | null)?.message ?? String(err ?? '');
  const found = /^\s*([a-z_]+)\s*$/i.exec(message);
  if (found) return found[1].toLowerCase();
  // PostgREST sometimes prefixes the code, e.g. "P0001: invalid_code".
  const prefixed = /(?:P\d{4}\s*:\s*)?\b([a-z][a-z0-9_]{2,40})\b/.exec(message);
  return prefixed ? prefixed[1].toLowerCase() : 'unknown';
}
