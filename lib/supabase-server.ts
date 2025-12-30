// lib/supabase-server.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "";

const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

function requireEnv(name: string, value: string) {
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

// Server-side anon client (no cookies/session helpers; safe for SSR reads)
export function supabaseServer(): SupabaseClient {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)", supabaseUrl),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", anonKey),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}

// Some of your older files used this name:
export const supabaseRoute = supabaseServer;





