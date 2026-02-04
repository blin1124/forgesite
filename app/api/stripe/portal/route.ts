import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Prefer request origin so it returns to the correct domain
function getBaseUrl(req: NextRequest) {
  const origin = req.nextUrl?.origin;
  if (origin) return origin;

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  if (host) return `${proto}://${host}`;

  const env =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL;

  if (env) return env.startsWith("http") ? env : `https://${env}`;
  return "https://www.forgesite.net";
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : "";

    if (!token) return NextResponse.json({ error: "Auth session missing" }, { status: 401 });

    const supabaseAdmin = getSupabaseAdmin();
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    const user = userData?.user;

    if (userErr || !user) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const returnTo = typeof body?.returnTo === "string" ? body.returnTo : "/billing";

    // You store this mapping in stripe_customers
    const { data: row, error: rowErr } = await supabaseAdmin
      .from("stripe_customers")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (rowErr) return NextResponse.json({ error: rowErr.message }, { status: 500 });

    const customerId = row?.stripe_customer_id ? String(row.stripe_customer_id) : "";
    if (!customerId) {
      return NextResponse.json(
        { error: "No Stripe customer found for this account yet." },
        { status: 400 }
      );
    }

    const base = getBaseUrl(req);
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${base}${returnTo.startsWith("/") ? returnTo : `/${returnTo}`}`,
    });

    return NextResponse.json({ url: portal.url }, { status: 200 });
  } catch (err: any) {
    console.error("Portal error:", err);
    return NextResponse.json({ error: err?.message || "Portal failed" }, { status: 500 });
  }
}





