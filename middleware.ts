import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Gate ONLY the paid parts of the app.
 * DO NOT gate:
 *  - /s/* (public shares)
 *  - /api/stripe/webhook (Stripe webhook)
 *  - auth pages (login/signup)
 *  - static assets
 */
function isGatedPath(pathname: string) {
  return (
    pathname.startsWith("/builder") ||
    pathname.startsWith("/sites") ||
    pathname.startsWith("/site") // in-app viewer (optional but recommended)
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // --- Always allow these paths (never gate) ---
  if (
    pathname.startsWith("/s/") ||
    pathname.startsWith("/api/stripe/webhook") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/callback") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/public")
  ) {
    return NextResponse.next();
  }

  // Not a gated route -> allow
  if (!isGatedPath(pathname)) return NextResponse.next();

  // Create response we can attach cookies to
  const res = NextResponse.next();

  // Supabase SSR client in middleware
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => req.cookies.get(name)?.value,
        set: (name, value, options) => res.cookies.set({ name, value, ...options }),
        remove: (name, options) => res.cookies.set({ name, value: "", ...options }),
      },
    }
  );

  // Check auth session
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;

  // Not logged in -> go to login, return to requested page after
  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Logged in -> check subscription status from profiles
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("subscription_status,current_period_end")
    .eq("id", user.id)
    .maybeSingle();

  // If profiles lookup fails, treat as not subscribed (send to billing)
  const status = profile?.subscription_status ?? null;
  const active = status === "active" || status === "trialing";

  if (active) return res;

  // Not subscribed -> go to billing, then return to requested page
  const url = req.nextUrl.clone();
  url.pathname = "/billing";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!.*\\.).*)"], // match all routes except files with extensions
};


