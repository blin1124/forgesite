// app/api/checkout/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const userId = String(body.userId || "").trim();
    const email = String(body.email || "").trim().toLowerCase();

    if (!userId) return new NextResponse("Missing userId", { status: 400 });
    if (!email) return new NextResponse("Missing email", { status: 400 });

    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecret) return new NextResponse("Missing STRIPE_SECRET_KEY", { status: 500 });

    const priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId) return new NextResponse("Missing STRIPE_PRICE_ID", { status: 500 });

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_VERCEL_URL?.startsWith("http")
        ? process.env.NEXT_PUBLIC_VERCEL_URL
        : process.env.NEXT_PUBLIC_VERCEL_URL
        ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
        : "http://localhost:3000";

    const stripe = new Stripe(stripeSecret, {
      // ✅ avoid strict apiVersion type mismatch across stripe types
      apiVersion: "2024-06-20" as any,
    });

    const customer = await stripe.customers.create({ email });

    // Save customer id (ignore failure so checkout can still proceed)
    try {
      await supabaseAdmin
        .from("profiles")
        .upsert({
          id: userId,
          stripe_customer_id: customer.id,
          updated_at: new Date().toISOString(),
        })
        .throwOnError();
    } catch {
      // no-op
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customer.id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/billing?success=1`,
      cancel_url: `${appUrl}/billing?canceled=1`,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    return new NextResponse(err?.message || "Checkout failed", { status: 500 });
  }
}




