import { createClient } from "@supabase/supabase-js";

/**
 * Admin (service-role) Supabase client.
 * - No session persistence.
 * - Safe to use ONLY in server routes (route.ts) / server runtime.
 */
export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!url) throw new Error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)");
  if (!service) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, service, { auth: { persistSession: false } });
}

/**
 * Back-compat alias (if other files were changed to use this name)
 */
export function getSupabaseAdmin() {
  return supabaseAdmin();
}
