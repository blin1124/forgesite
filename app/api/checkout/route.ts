import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : "";

    if (!token) {
      return NextResponse.json({ error: "Auth session missing" }, { status: 401 });
    }

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    const user = userData?.user;

    if (userErr || !user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    // allow passing "next" from BillingClient, fallback /builder
    const body = await req.json().catch(() => ({}));
    const next = typeof body?.next === "string" ? body.next : "/builder";

    const priceId = process.env.STRIPE_PRICE_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!priceId) return NextResponse.json({ error: "Missing STRIPE_PRICE_ID" }, { status: 500 });
    if (!appUrl) return NextResponse.json({ error: "Missing NEXT_PUBLIC_APP_URL" }, { status: 500 });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: user.email ?? undefined,
      metadata: {
        supabase_user_id: user.id,
      },
      success_url: `${appUrl}/pro/success?session_id={CHECKOUT_SESSION_ID}&next=${encodeURIComponent(next)}`,
      cancel_url: `${appUrl}/billing?next=${encodeURIComponent(next)}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("Checkout error:", err);
    return NextResponse.json({ error: err?.message || "Checkout failed" }, { status: 500 });
  }
}









