// lib/supabase-server.ts
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Back-compat helper for Route Handlers.
 * Some files import { supabaseRoute } from "@/lib/supabase-server"
 */
export function supabaseRoute() {
  return createSupabaseServerClient();
}



