import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // ✅ 1) NEVER protect API routes (fixes /api/checkout redirecting to /login)
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // ✅ 2) Allow Next.js internals + static assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|webp|ico|css|js|map)$/)
  ) {
    return NextResponse.next();
  }

  // ✅ 3) Public pages that must remain accessible
  const publicPaths = [
    "/",
    "/login",
    "/signup",
    "/billing",
    "/callback",
    "/auth/callback",
    "/terms",
    "/privacy",
    "/pro/success",
  ];

  if (publicPaths.includes(pathname)) {
    return NextResponse.next();
  }

  // ✅ 4) Supabase session check for everything else
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

  const { data } = await supabase.auth.getUser();
  const user = data?.user;

  // Not logged in -> login
  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  // ✅ 5) Entitlement gate: builder + other protected pages require active entitlement
  // Adjust this list to whatever should be paid-only.
  const paidOnlyPrefixes = ["/builder", "/sites", "/templates", "/team", "/settings", "/uploads", "/domain"];

  const isPaidOnly = paidOnlyPrefixes.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (isPaidOnly) {
    // Check entitlement in DB (service role)
    const { data: ent } = await supabaseAdmin
      .from("entitlements")
      .select("status,current_period_end")
      .eq("user_id", user.id)
      .maybeSingle();

    const status = (ent?.status || "").toLowerCase();
    const cpe = ent?.current_period_end ? new Date(ent.current_period_end).getTime() : null;
    const now = Date.now();

    const active =
      status === "active" ||
      status === "trialing" ||
      (status === "past_due" && cpe && cpe > now); // optional leniency

    if (!active) {
      const url = req.nextUrl.clone();
      url.pathname = "/billing";
      url.search = `?next=${encodeURIComponent(pathname + search)}`;
      return NextResponse.redirect(url);
    }
  }

  return res;
}

// ✅ apply middleware to all routes (but we early-return above for /api and assets)
export const config = {
  matcher: ["/:path*"],
};







