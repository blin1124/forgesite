// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes anyone can view without being logged in
const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/signup",
  "/terms",
  "/privacy",
  "/billing", // billing page can be shown, but it will require login inside page if you want
]);

// Files / assets / Next internals
function isPublicFile(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/public") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".jpeg") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".css") ||
    pathname.endsWith(".js")
  );
}

export async function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  if (isPublicFile(pathname)) return NextResponse.next();
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  // Require login for everything else
  // We detect login by presence of Supabase auth cookies (standard names)
  const hasAuthCookie =
    req.cookies.get("sb-access-token") ||
    req.cookies.get("sb-refresh-token") ||
    // some supabase setups use "supabase-auth-token"
    req.cookies.get("supabase-auth-token");

  if (!hasAuthCookie) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Enforce "must pay before builder"
  // Only gate these paths. Add more if needed.
  const gated = pathname.startsWith("/builder");

  if (!gated) return NextResponse.next();

  // Call your entitlement endpoint (must exist and return { active: boolean })
  // Uses same domain so it works on Vercel + preview.
  const origin = req.nextUrl.origin;
  const entitlementUrl = new URL("/api/entitlement", origin);

  // Forward cookies so API can see the user session
  const res = await fetch(entitlementUrl, {
    headers: { cookie: req.headers.get("cookie") || "" },
  }).catch(() => null);

  if (!res || !res.ok) {
    // If entitlement check fails, safest behavior is to send to billing
    const url = req.nextUrl.clone();
    url.pathname = "/billing";
    return NextResponse.redirect(url);
  }

  const data = await res.json().catch(() => ({ active: false }));
  if (!data?.active) {
    const url = req.nextUrl.clone();
    url.pathname = "/billing";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};





