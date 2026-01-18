import { NextRequest, NextResponse } from "next/server";

const MARKETING_HOSTS = new Set([
  "forgesite.net",
  "www.forgesite.net",
]);

function stripPort(host: string) {
  return host.split(":")[0];
}

function normalizeHost(host: string) {
  const h = stripPort(host.trim().toLowerCase());
  // common: users type/land on www.*
  return h.startsWith("www.") ? h.slice(4) : h;
}

function isBypassPath(pathname: string) {
  return (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/robots.txt") ||
    pathname.startsWith("/sitemap") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/assets") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/builder") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/domain") // keep your domain UI as-is
  );
}

/**
 * Resolve hostname -> site_id from Supabase (custom_domains).
 * Requires:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY
 *
 * IMPORTANT:
 * Your Supabase RLS must allow SELECT on custom_domains for:
 *   domain = <hostname> AND vercel_verified = true
 * (or you can relax this to allow SELECT on verified domains only).
 */
async function resolveSiteIdByHost(hostname: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) return null;

  // Query PostgREST directly (fast + works in middleware)
  // Table: custom_domains
  // Columns used: domain, site_id, vercel_verified
  const url =
    `${supabaseUrl}/rest/v1/custom_domains` +
    `?select=site_id` +
    `&domain=eq.${encodeURIComponent(hostname)}` +
    `&vercel_verified=eq.true` +
    `&limit=1`;

  const res = await fetch(url, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    // avoid caching host->site mapping during changes
    cache: "no-store",
  });

  if (!res.ok) return null;

  const json = (await res.json().catch(() => null)) as null | Array<{ site_id: string }>;
  const siteId = json?.[0]?.site_id || null;
  return siteId;
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Let Next handle static/API/auth pages normally
  if (isBypassPath(pathname)) return NextResponse.next();

  const hostHeader = req.headers.get("host") || "";
  if (!hostHeader) return NextResponse.next();

  const rawHost = stripPort(hostHeader);
  const hostNoWww = normalizeHost(rawHost);

  // Keep marketing site intact on your main domain(s)
  if (MARKETING_HOSTS.has(rawHost) || MARKETING_HOSTS.has(hostNoWww)) {
    return NextResponse.next();
  }

  // If running on vercel.app preview domains, do NOT rewrite
  if (hostNoWww.endsWith(".vercel.app")) {
    return NextResponse.next();
  }

  // Resolve custom domain -> siteId
  const siteId = await resolveSiteIdByHost(hostNoWww);
  if (!siteId) {
    // If no mapping, show marketing (or you could show a 404 page)
    return NextResponse.next();
  }

  // Rewrite: /anything -> /s/<siteId>/anything
  const rewriteUrl = req.nextUrl.clone();
  rewriteUrl.pathname = `/s/${siteId}${pathname === "/" ? "" : pathname}`;

  return NextResponse.rewrite(rewriteUrl);
}

// Run middleware on all routes except Next internals (we also hard-check in code)
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};











