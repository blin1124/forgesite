import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    // ✅ Expect token from client
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : "";

    if (!token) {
      return NextResponse.json({ error: "Auth session missing" }, { status: 401 });
    }

    // ✅ Validate user using service role client
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    const user = userData?.user;

    if (userErr || !user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const priceId = process.env.STRIPE_PRICE_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!priceId) {
      return NextResponse.json({ error: "Missing STRIPE_PRICE_ID" }, { status: 500 });
    }
    if (!appUrl) {
      return NextResponse.json({ error: "Missing NEXT_PUBLIC_APP_URL" }, { status: 500 });
    }

    // ✅ Create Checkout session
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],

      customer_email: user.email ?? undefined,

      // 🔥 critical for webhook entitlement unlock
      metadata: {
        supabase_user_id: user.id,
      },

      success_url: `${appUrl}/pro/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("Checkout error:", err);
    return NextResponse.json({ error: err?.message || "Checkout failed" }, { status: 500 });
  }
}









