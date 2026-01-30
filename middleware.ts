import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: [
    // Run on everything except Next internals/static files
    "/((?!_next|.*\\..*).*)",
  ],
};

// Hosts that should NOT be treated as customer domains
function isAppHost(host: string) {
  const h = host.toLowerCase();
  return (
    h === "forgesite.net" ||
    h === "www.forgesite.net" ||
    h.endsWith(".vercel.app") ||
    h.includes("localhost")
  );
}

function stripPort(host: string) {
  return host.split(":")[0];
}

function toApex(host: string) {
  const h = stripPort(host).toLowerCase();
  return h.startsWith("www.") ? h.slice(4) : h;
}

function isBypassPath(pathname: string) {
  // Don’t rewrite these routes
  return (
    pathname.startsWith("/api") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/billing") ||
    pathname.startsWith("/builder") ||
    pathname.startsWith("/domain") ||
    pathname.startsWith("/account") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/_hosted") ||
    pathname.startsWith("/privacy")
  );
}

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const pathname = url.pathname;

  // Skip paths we never want to rewrite
  if (isBypassPath(pathname)) return NextResponse.next();

  const hostHeader = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const host = stripPort(hostHeader).toLowerCase();
  const apex = toApex(hostHeader);

  // App host? Let it work normally
  if (!host || isAppHost(host)) return NextResponse.next();

  // Already on /s/... path? Also let it through (prevents loops)
  if (pathname.startsWith("/s/")) return NextResponse.next();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  // IMPORTANT: use SERVICE ROLE for middleware lookups so RLS cannot block routing
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE;

  // If missing, don’t break the app
  if (!supabaseUrl || !serviceKey) return NextResponse.next();

  // Lookup BOTH:
  // - exact host (might be www.powertrainbaseball.com)
  // - apex host (powertrainbaseball.com)
  // We also require verified to prevent routing unverified domains.
  //
  // PostgREST OR syntax:
  //   &or=(domain.eq.<host>,domain.eq.<apex>)
  // If host==apex, it still works.
  const or = `or=(domain.eq.${encodeURIComponent(host)},domain.eq.${encodeURIComponent(apex)})`;

  const lookupUrl =
    `${supabaseUrl}/rest/v1/custom_domains` +
    `?select=site_id,status,verified,domain` +
    `&${or}` +
    `&limit=1`;

  try {
    const r = await fetch(lookupUrl, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      cache: "no-store",
    });

    if (!r.ok) return NextResponse.next();

    const rows = (await r.json()) as Array<{
      site_id: string | null;
      status?: string | null;
      verified?: boolean | null;
      domain?: string | null;
    }>;

    const row = rows?.[0];

    if (!row?.site_id) return NextResponse.next();

    // Require verified either by bool or status
    const st = String(row.status || "").toLowerCase();
    const isVerified = row.verified === true || st === "verified";
    if (!isVerified) return NextResponse.next();

    // Rewrite customer domain -> /s/{site_id}{pathname}
    const rewriteUrl = req.nextUrl.clone();
    rewriteUrl.pathname = `/s/${row.site_id}${pathname}`;
    return NextResponse.rewrite(rewriteUrl);
  } catch {
    return NextResponse.next();
  }
}


