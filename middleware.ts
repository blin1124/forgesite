import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

function isAsset(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|webp|ico|css|js|map)$/i)
  );
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // 1) NEVER protect API routes
  if (pathname.startsWith("/api")) return NextResponse.next();

  // 2) Allow Next.js internals + static assets
  if (isAsset(pathname)) return NextResponse.next();

  // 3) Public pages
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
  if (publicPaths.includes(pathname)) return NextResponse.next();

  // 4) Build Supabase server client using request cookies
  const res = NextResponse.next();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!supabaseUrl || !supabaseAnon) return res;

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

  // 5) Auth gate
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;

  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  // 6) Entitlement gate (only for Builder routes — edit these rules as you want)
  const needsEntitlement =
    pathname === "/builder" ||
    pathname.startsWith("/builder/") ||
    pathname === "/sites" ||
    pathname.startsWith("/sites/") ||
    pathname === "/templates" ||
    pathname.startsWith("/templates/") ||
    pathname === "/domain" ||
    pathname.startsWith("/domain/");

  if (needsEntitlement) {
    // IMPORTANT:
    // This assumes your `entitlements` table is readable for the logged-in user.
    // If you turned ON RLS for entitlements, add the policy: user_id = auth.uid().
    const { data: ent, error } = await supabase
      .from("entitlements")
      .select("status,current_period_end")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const status = (ent?.status || "").toLowerCase();

    // Treat these as "paid/active"
    const isActive =
      status === "active" || status === "trialing" || status === "paid";

    if (error || !ent || !isActive) {
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









