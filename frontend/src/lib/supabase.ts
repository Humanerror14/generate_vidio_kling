import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Guard against missing URLs which cause createClient to throw
const safeUrl = supabaseUrl || "https://placeholder.supabase.co";

// Client for public use (client-side)
export const supabase = createClient(safeUrl, supabaseAnonKey);

// Client for admin use (server-side, bypasses RLS)
export const supabaseAdmin = createClient(safeUrl, supabaseServiceKey);
