import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

function getAllCookies(): { name: string; value: string }[] {
  if (typeof document === "undefined") return [];
  if (!document.cookie) return [];
  return document.cookie.split(";").map((c) => {
    const [name, ...rest] = c.trim().split("=");
    return { name, value: decodeURIComponent(rest.join("=") || "") };
  });
}

function setCookie(
  name: string,
  value: string,
  options?: {
    path?: string;
    maxAge?: number;
    expires?: Date;
    sameSite?: "lax" | "strict" | "none";
    secure?: boolean;
    domain?: string;
  }
) {
  if (typeof document === "undefined") return;

  const parts: string[] = [];
  parts.push(`${name}=${encodeURIComponent(value)}`);
  parts.push(`Path=${options?.path ?? "/"}`);

  if (options?.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options?.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  if (options?.domain) parts.push(`Domain=${options.domain}`);
  if (options?.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options?.secure) parts.push("Secure");

  document.cookie = parts.join("; ");
}

/**
 * This is the name your app expects.
 * It MUST persist auth in cookies so middleware can see it.
 */
export function createSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  browserClient = createBrowserClient(url, anon, {
    cookies: {
      getAll() {
        return getAllCookies();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          setCookie(name, value, {
            path: options?.path ?? "/",
            maxAge: options?.maxAge,
            expires: options?.expires,
            sameSite: (options?.sameSite as any) ?? "lax",
            secure: options?.secure ?? true,
            domain: options?.domain,
          });
        });
      },
    },
  });

  return browserClient;
}

// optional alias if you use it elsewhere
export function supabaseBrowser(): SupabaseClient {
  return createSupabaseBrowserClient();
}













