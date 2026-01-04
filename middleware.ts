import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const config = {
  matcher: ["/builder/:path*", "/sites/:path*", "/templates/:path*", "/domain/:path*"],
};

function isActive(status: string | null | undefined) {
  return status === "active" || status === "trialing";
}

function notExpired(currentPeriodEnd: string | null | undefined) {
  if (!currentPeriodEnd) return true; // if you don't store it, don't block
  const t = Date.parse(currentPeriodEnd);
  if (Number.isNaN(t)) return true;
  return t > Date.now();
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Never block these (safety)
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/billing") ||
    pathname.startsWith("/pro/success") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const nextParam = encodeURIComponent(pathname + (search || ""));

  // 1) Auth check
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;

  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${nextParam}`;
    return NextResponse.redirect(url);
  }

  // 2) Entitlement check
  const { data: ent, error } = await supabase
    .from("entitlements")
    .select("status, current_period_end")
    .eq("user_id", user.id)
    .maybeSingle();

  // If query fails or row missing or not active → billing
  if (error || !ent || !isActive(ent.status) || !notExpired(ent.current_period_end)) {
    const url = req.nextUrl.clone();
    url.pathname = "/billing";
    url.search = `?next=${nextParam}`;
    return NextResponse.redirect(url);
  }

  return res;
}










