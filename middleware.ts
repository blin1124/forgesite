import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          res.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          res.cookies.set({ name, value: "", ...options, maxAge: 0 });
        },
      },
    }
  );

  const path = req.nextUrl.pathname;

  // ✅ Public routes (no login required)
  const isPublic =
    path === "/" ||
    path.startsWith("/login") ||
    path.startsWith("/signup") ||
    path.startsWith("/terms") ||
    path.startsWith("/privacy") ||
    path.startsWith("/api/stripe/webhook") ||
    path.startsWith("/api/health");

  // Get user (auth)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If not logged in and not public -> login
  if (!user && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  // ✅ Routes that require payment/subscription
  const requiresPaid =
    path.startsWith("/builder") ||
    path.startsWith("/sites") ||
    path.startsWith("/site") ||
    path.startsWith("/templates");

  // If logged in and trying to access paid areas, verify subscription
  if (user && requiresPaid) {
    // 🔧 CHANGE THIS if your schema uses a different table/column
    // Table: profiles
    // Column: subscription_status
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("subscription_status")
      .eq("id", user.id)
      .single();

    const status = profile?.subscription_status;

    const hasAccess = status === "active" || status === "trialing";

    // If missing profile row or not active -> send to billing
    if (error || !hasAccess) {
      const url = req.nextUrl.clone();
      url.pathname = "/billing";
      url.searchParams.set("next", path); // optional: remember where they wanted to go
      return NextResponse.redirect(url);
    }
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};




