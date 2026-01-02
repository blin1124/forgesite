import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  /**
   * 0) Never protect API routes (fixes /api/checkout redirecting to /login)
   */
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  /**
   * 1) Allow Next.js internals + static assets
   */
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|webp|ico|css|js|map)$/)
  ) {
    return NextResponse.next();
  }

  /**
   * 2) Public routes: always accessible
   */
  const publicPaths = [
    "/",
    "/login",
    "/signup",
    "/billing",
    "/callback",
    "/auth/callback",
    "/terms",
    "/privacy",
  ];

  if (publicPaths.includes(pathname)) {
    return NextResponse.next();
  }

  /**
   * 3) Routes that REQUIRE an active subscription
   *    Add/remove anything you want to gate.
   */
  const paidPrefixes = [
    "/builder",
    "/sites",
    "/templates",
    "/settings",
    "/domain",
    "/account", // if you want account behind paywall; remove if not
    "/team",    // optional
  ];

  const isPaidRoute = paidPrefixes.some((p) =>
    pathname === p || pathname.startsWith(p + "/")
  );

  /**
   * 4) Create Supabase server client using cookies
   */
  const res = NextResponse.next();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = createServerClient(supabaseUrl, supabaseAnon, {
    cookies: {
      get(name: string) {
        return req.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        res.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: any) {
        res.cookies.set({ name, value: "", ...options });
      },
    },
  });

  /**
   * 5) Auth gate: if not logged in, go to /login?next=...
   */
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;

  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  /**
   * 6) Entitlement gate (only for paid routes)
   *    Requires entitlements row with status = "active"
   *    AND current_period_end is null OR in the future.
   */
  if (isPaidRoute) {
    const nowIso = new Date().toISOString();

    const { data: ent, error } = await supabase
      .from("entitlements")
      .select("status,current_period_end")
      .eq("user_id", user.id)
      .maybeSingle();

    const isActive =
      !error &&
      ent &&
      ent.status === "active" &&
      (!ent.current_period_end || ent.current_period_end > nowIso);

    if (!isActive) {
      const url = req.nextUrl.clone();
      url.pathname = "/billing";
      url.search = `?next=${encodeURIComponent(pathname + search)}`;
      return NextResponse.redirect(url);
    }
  }

  /**
   * 7) Allowed through (authed + entitled if required)
   */
  return res;
}

/**
 * Apply middleware broadly, but we early-return above for /api and assets.
 */
export const config = {
  matcher: ["/:path*"],
};






