import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

function isPaidPath(pathname: string) {
  // Add any routes you want to require subscription for
  return (
    pathname.startsWith("/builder") ||
    pathname.startsWith("/domain") ||
    pathname.startsWith("/sites") ||
    pathname.startsWith("/templates")
  );
}

function isActive(status: string | null, currentPeriodEnd: string | null) {
  if (status !== "active" && status !== "trialing") return false;
  if (!currentPeriodEnd) return true;
  return new Date(currentPeriodEnd).getTime() > Date.now();
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // 1) NEVER protect API routes
  if (pathname.startsWith("/api")) return NextResponse.next();

  // 2) Allow Next internals + static assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|webp|ico|css|js|map)$/)
  ) {
    return NextResponse.next();
  }

  // 3) Public routes
  const publicPaths = [
    "/",
    "/login",
    "/signup",
    "/billing",
    "/terms",
    "/privacy",
    "/callback",
    "/auth/callback",
    "/pro/success", // IMPORTANT: must be reachable after Stripe returns
  ];
  if (publicPaths.includes(pathname)) return NextResponse.next();

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

  // 4) Auth gate
  const { data } = await supabase.auth.getUser();
  const user = data?.user;

  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  // 5) Entitlement gate (only for paid paths)
  if (isPaidPath(pathname)) {
    const ent = await supabase
      .from("entitlements")
      .select("status,current_period_end,updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const ok = !ent.error && ent.data && isActive(ent.data.status ?? null, ent.data.current_period_end ?? null);

    if (!ok) {
      const url = req.nextUrl.clone();
      url.pathname = "/billing";
      url.search = `?next=${encodeURIComponent(pathname + search)}`;
      return NextResponse.redirect(url);
    }
  }

  return res;
}

export const config = {
  matcher: ["/:path*"],
};









