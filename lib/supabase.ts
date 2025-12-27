import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function required(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing ${name} environment variable`);
  }
  return value;
}

/**
 * Public (anon) client — safe for read-only / RLS-protected operations.
 * Use this in server routes when you only need anon access.
 */
export function supabaseAnon(): SupabaseClient {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;

  const anon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;

  return createClient(
    required("NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)", url),
    required("NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_ANON_KEY)", anon),
    {
      auth: { persistSession: false },
    }
  );
}

/**
 * Admin client (service role) — server-only. NEVER expose this to the browser.
 * Use this in API routes that must bypass RLS (billing, provisioning, etc).
 */
export function supabaseAdmin(): SupabaseClient {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;

  const serviceRole =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  return createClient(
    required("NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)", url),
    required("SUPABASE_SERVICE_ROLE_KEY", serviceRole),
    {
      auth: { persistSession: false },
    }
  );
}

/**
 * Backwards-compatible default export (if any of your code imports default).
 * Prefer using supabaseAnon() or supabaseAdmin() explicitly.
 */
export default supabaseAnon;


