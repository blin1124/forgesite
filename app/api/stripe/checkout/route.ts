import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-12-15.clover",
});

// ✅ Always prefer the actual request origin first.
// This prevents Stripe redirecting to a protected *.vercel.app domain.
function getBaseUrl(req: NextRequest) {
  // Most reliable
  const origin = req.nextUrl?.origin;
  if (origin) return origin;

  // Fallback to forwarded host
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  if (host) return `${proto}://${host}`;

  // Last resort: env
  const env =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL;

  if (env) return env.startsWith("http") ? env : `https://${env}`;

  // Hard fallback
  return "https://www.forgesite.net";
}

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

    if (!token) {
      return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const next = typeof body?.next === "string" ? body.next : "/builder";

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.json(
        { error: "Missing Supabase env vars" },
        { status: 500 }
      );
    }

    // Validate JWT + get user
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const user = userRes.user;

    const priceId = process.env.STRIPE_PRICE_ID || "";
    if (!priceId) {
      return NextResponse.json(
        { error: "Missing STRIPE_PRICE_ID" },
        { status: 500 }
      );
    }

    const base = getBaseUrl(req);

    // ✅ IMPORTANT: use your ACTUAL success page route
    // You have /billing/success
    const successUrl =
      `${base}/billing/success?session_id={CHECKOUT_SESSION_ID}` +
      `&next=${encodeURIComponent(next)}`;

    const cancelUrl = `${base}/billing?next=${encodeURIComponent(next)}`;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: user.email || undefined,
      client_reference_id: user.id,
      metadata: {
        user_id: user.id,
        next,
      },
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Checkout failed" },
      { status: 500 }
    );
  }
}







