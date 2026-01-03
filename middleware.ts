import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

function isGatedPath(pathname: string) {
  return (
    pathname.startsWith("/builder") ||
    pathname.startsWith("/sites") ||
    pathname.startsWith("/domain") ||
    pathname.startsWith("/templates") ||
    pathname.startsWith("/account") ||
    pathname.startsWith("/settings")
  );
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // ✅ Never gate API routes
  if (pathname.startsWith("/api")) return NextResponse.next();

  // ✅ Next.js internals / assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|webp|ico|css|js|map)$/)
  ) {
    return NextResponse.next();
  }

  // ✅ Always public pages
  if (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/billing" ||
    pathname === "/terms" ||
    pathname === "/privacy" ||
    pathname === "/callback" ||
    pathname === "/auth/callback" ||
    pathname.startsWith("/s/") ||
    pathname.startsWith("/pro/")
  ) {
    return NextResponse.next();
  }

  if (!isGatedPath(pathname)) return NextResponse.next();

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

  // ✅ Must be logged in
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;

  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  // ✅ Must be entitled (webhook writes entitlements)
  const { data: ent } = await supabase
    .from("entitlements")
    .select("status,current_period_end")
    .eq("user_id", user.id)
    .maybeSingle();

  const active = ent?.status === "active" || ent?.status === "trialing";
  if (active) return res;

  const url = req.nextUrl.clone();
  url.pathname = "/billing";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/:path*"],
};








