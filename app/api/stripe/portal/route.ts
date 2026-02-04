import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-12-15.clover",
});

// prefer real request origin
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
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";

    if (!token) {
      return NextResponse.json({ error: "Auth session missing" }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    const user = userData?.user;

    if (userErr || !user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const returnTo = typeof body?.returnTo === "string" ? body.returnTo : "/billing";

    const base = getBaseUrl(req);
    const return_url = `${base}${returnTo.startsWith("/") ? returnTo : `/${returnTo}`}`;

    // 1) Try your DB mapping first (recommended)
    let customerId: string | null = null;

    try {
      const { data: row } = await supabaseAdmin
        .from("stripe_customers")
        .select("stripe_customer_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (row?.stripe_customer_id) customerId = String(row.stripe_customer_id);
    } catch {
      // ignore if table missing
    }

    // 2) Fallback: search Stripe by email (only if needed)
    if (!customerId && user.email) {
      const list = await stripe.customers.list({
        email: user.email,
        limit: 1,
      });

      if (list.data?.[0]?.id) customerId = list.data[0].id;
    }

    if (!customerId) {
      return NextResponse.json(
        { error: "No Stripe customer found for this account yet." },
        { status: 400 }
      );
    }

    // Stripe Customer Portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url,
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err: any) {
    console.error("Portal error:", err);
    return NextResponse.json(
      { error: err?.message || "Portal failed" },
      { status: 500 }
    );
  }
}






