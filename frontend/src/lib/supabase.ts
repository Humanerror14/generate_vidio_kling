import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;
let _supabaseAdmin: SupabaseClient | null = null;

export function getSupabase() {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    if (!url || !key) {
      throw new Error("Supabase URL and Anon Key are required.");
    }
    _supabase = createClient(url, key);
  }
  return _supabase;
}

export function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!url || !key) {
      throw new Error("Supabase URL and Service Role Key are required.");
    }
    _supabaseAdmin = createClient(url, key);
  }
  return _supabaseAdmin;
}

// Keep the static exports but make them proxies or just keep them for compatibility if possible
// Actually, it's better to update the callers to use the functions.
// But for a quick fix that doesn't break everything, let's keep the names but initialize them lazily.

export const supabase = {
  get auth() { return getSupabase().auth; },
  get storage() { return getSupabase().storage; },
  from: (table: string) => getSupabase().from(table),
} as any;

export const supabaseAdmin = {
  get auth() { return getSupabaseAdmin().auth; },
  get storage() { return getSupabaseAdmin().storage; },
  from: (table: string) => getSupabaseAdmin().from(table),
} as any;
