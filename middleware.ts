// middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const config = {
  matcher: ["/builder/:path*", "/sites/:path*", "/templates/:path*", "/domain/:path*"],
};

function isActive(status: string | null | undefined) {
  return status === "active" || status === "trialing";
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const { pathname, search } = req.nextUrl;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If env is missing, don't hard-crash middleware — just let request through
  if (!url || !anon) return res;

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const nextParam = encodeURIComponent(pathname + (search || ""));

  // Not logged in -> login
  if (!user) {
    const redirect = req.nextUrl.clone();
    redirect.pathname = "/login";
    redirect.search = `?next=${nextParam}`;
    return NextResponse.redirect(redirect);
  }

  // Logged in -> must have active entitlement
  const { data: ent, error } = await supabase
    .from("entitlements")
    .select("status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !ent || !isActive(ent.status)) {
    const redirect = req.nextUrl.clone();
    redirect.pathname = "/billing";
    redirect.search = `?next=${nextParam}`;
    return NextResponse.redirect(redirect);
  }

  return res;
}











