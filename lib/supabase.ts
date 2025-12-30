import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "";

const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "";

function requireEnv(name: string, value: string) {
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

// ✅ Browser/client-side Supabase (anon key)
export function supabaseBrowser(): SupabaseClient {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL", supabaseUrl),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", anonKey)
  );
}

// ✅ Server/admin Supabase (service role key) — OBJECT (NOT A FUNCTION)
export const supabaseAdmin: SupabaseClient = createClient(
  requireEnv("NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)", supabaseUrl),
  requireEnv("SUPABASE_SERVICE_ROLE_KEY", serviceRoleKey),
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);

