import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getOrigin(req: Request) {
  // Vercel + local safe origin detection
  const fromHeader = req.headers.get("origin");
  if (fromHeader) return fromHeader;

  const url = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (url) return url.replace(/\/$/, "");

  return "http://localhost:3000";
}

export async function POST(req: Request) {
  try {
    const origin = getOrigin(req);

    // 🔑 MUST exist in Vercel env vars
    const priceId =
      process.env.STRIPE_PRICE_ID ||
      process.env.STRIPE_PRO_PRICE_ID ||
      process.env.STRIPE_SUBSCRIPTION_PRICE_ID;

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: "Missing STRIPE_SECRET_KEY in environment variables." },
        { status: 500 }
      );
    }

    if (!priceId) {
      return NextResponse.json(
        {
          error:
            "Missing Stripe price id. Set STRIPE_PRICE_ID (or STRIPE_PRO_PRICE_ID) in environment variables.",
        },
        { status: 500 }
      );
    }

    // Body optional, but supports next redirect
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const nextPath = typeof body?.next === "string" && body.next.trim() ? body.next.trim() : "/builder";
    const successUrl = `${origin}/pro/success?next=${encodeURIComponent(nextPath)}`;
    const cancelUrl = `${origin}/billing?next=${encodeURIComponent(nextPath)}`;

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,

      // Optional: if you start passing email from client, this helps Stripe prefill
      customer_email: typeof body?.email === "string" ? body.email : undefined,

      // Helpful metadata for webhook / debugging
      metadata: {
        next: nextPath,
        app: "forgesite",
      },
    });

    if (!session.url) {
      return NextResponse.json({ error: "Stripe did not return a checkout URL." }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("Checkout error:", err);
    return NextResponse.json(
      { error: err?.message || "Checkout failed" },
      { status: 500 }
    );
  }
}




