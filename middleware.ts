import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const config = {
  matcher: ["/builder/:path*", "/sites/:path*", "/templates/:path*", "/domain/:path*"],
};

function isActive(status: string | null | undefined) {
  return status === "active" || status === "trialing";
}

export async function middleware(req: NextRequest) {
  // IMPORTANT: create a response we can attach cookies to
  const res = NextResponse.next();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Hard fail if env is missing (prevents silent “always logged out”)
  if (!supabaseUrl || !supabaseAnon) {
    return NextResponse.next();
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnon, {
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
  });

  const { pathname, search } = req.nextUrl;
  const nextParam = encodeURIComponent(pathname + (search || ""));

  // ✅ This is the key: refresh session on the server using cookies
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  // ✅ Return the response that has any refreshed cookies set
  return res;
}












