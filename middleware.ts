import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const config = {
  matcher: [
    // Run on everything except Next internals + api
    "/((?!_next|api|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};

function isActive(status: string | null | undefined) {
  return status === "active" || status === "trialing";
}

function isCustomHost(host: string) {
  const h = host.toLowerCase();
  if (!h) return false;
  if (h.includes("localhost")) return false;
  if (h.endsWith(".vercel.app")) return false;
  if (h === "forgesite.net" || h === "www.forgesite.net") return false;
  if (h.endsWith(".forgesite.net")) return false;
  return true;
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const { pathname, search } = req.nextUrl;

  const host = (req.headers.get("host") || "").toLowerCase();

  // ------------------------------------------------------------
  // 1) HOST ROUTING (subdomains + custom domains) -> hosted site
  // ------------------------------------------------------------
  // Subdomain: whatever.forgesite.net
  if (host.endsWith(".forgesite.net") && host !== "forgesite.net" && host !== "www.forgesite.net") {
    const sub = host.replace(".forgesite.net", "");
    const url = req.nextUrl.clone();
    url.pathname = `/_hosted/subdomain/${sub}${pathname === "/" ? "" : pathname}`;
    url.search = search; // preserve query
    return NextResponse.rewrite(url);
  }

  // Custom domain: customer.com
  if (isCustomHost(host)) {
    const url = req.nextUrl.clone();
    url.pathname = `/_hosted/domain${pathname === "/" ? "" : pathname}`;
    url.search = `?d=${encodeURIComponent(host)}${search ? `&${search.replace(/^\?/, "")}` : ""}`;
    return NextResponse.rewrite(url);
  }

  // ------------------------------------------------------------
  // 2) AUTH + ENTITLEMENT GATING (only for protected app areas)
  // ------------------------------------------------------------
  const protectedPaths = ["/builder", "/sites", "/templates", "/domain"];
  const isProtected = protectedPaths.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (!isProtected) return res;

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

  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${nextParam}`;
    return NextResponse.redirect(url);
  }

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










