import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const config = {
  matcher: [
    // gate the builder + anything else you want protected
    "/builder/:path*",
    "/sites/:path*",
    "/templates/:path*",
    "/domain/:path*",
  ],
};

function isActive(status: string | null | undefined) {
  return status === "active" || status === "trialing";
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Always allow these (avoid blocking auth + stripe flows)
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/billing") ||
    pathname.startsWith("/pro/success")
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

  // 1) Auth check
  const { data: { user } } = await supabase.auth.getUser();

  const nextParam = encodeURIComponent(pathname + (search || ""));

  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${nextParam}`;
    return NextResponse.redirect(url);
  }

  // 2) Entitlement check (expects entitlements.user_id = auth.uid())
  const { data: ent, error } = await supabase
    .from("entitlements")
    .select("status, current_period_end")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    // If RLS blocks this or table missing, you’ll see it immediately
    const url = req.nextUrl.clone();
    url.pathname = "/billing";
    url.search = `?next=${nextParam}`;
    return NextResponse.redirect(url);
  }

  if (!ent || !isActive(ent.status)) {
    const url = req.nextUrl.clone();
    url.pathname = "/billing";
    url.search = `?next=${nextParam}`;
    return NextResponse.redirect(url);
  }

  // Allowed
  return res;
}










