// lib/supabase-server.ts
import { cookies } from "next/headers";
import { createRouteHandlerClient, createServerComponentClient } from "@supabase/auth-helpers-nextjs";

/**
 * Use inside Server Components (e.g. app/**/page.tsx that are NOT "use client")
 */
export function supabaseServer() {
  return createServerComponentClient({ cookies });
}

/**
 * Use inside Route Handlers (e.g. app/api/**/route.ts)
 */
export function supabaseRoute() {
  return createRouteHandlerClient({ cookies });
}
