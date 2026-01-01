import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

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

  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  return res;
}

// ✅ apply middleware to all routes (but we early-return above for /api and assets)
export const config = {
  matcher: ["/:path*"],
};






