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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const nextParam = encodeURIComponent(pathname + (search || ""));

  // Not logged in -> login
  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${nextParam}`;
    return NextResponse.redirect(url);
  }

  // Logged in -> must have active entitlement
  const { data: ent, error } = await supabase
    .from("entitlements")
    .select("status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !ent || !isActive(ent.status)) {
    const url = req.nextUrl.clone();
    url.pathname = "/billing";
    url.search = `?next=${nextParam}`;
    return NextResponse.redirect(url);
  }

  return res;
}











