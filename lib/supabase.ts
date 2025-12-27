// lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client using the Service Role key.
 * Use ONLY in server code (Route Handlers, Server Actions).
 */
const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error(
    "Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) environment variable."
  );
}

if (!serviceRoleKey) {
  throw new Error("Missing SUPABASE_SERVICE
