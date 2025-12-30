  "use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anon) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

// One shared client for the browser
const client: SupabaseClient = createBrowserClient(url, anon);

/**
 * Supports ALL usage styles in your repo:
 * - supabaseBrowser.auth...
 * - supabaseBrowser().auth...
 * - default import OR named import
 */
const hybrid = Object.assign(() => client, client) as unknown as SupabaseClient & (() => SupabaseClient);

export const supabaseBrowser = hybrid;
export default hybrid;


