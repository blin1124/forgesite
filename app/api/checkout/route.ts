import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    // ✅ Expect Bearer token from client
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

    // ✅ Read { next } from body
    const body = await req.json().catch(() => ({}));
    const next = typeof body?.next === "string" ? body.next : "/builder";

    const priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId) {
      return NextResponse.json({ error: "Missing STRIPE_PRICE_ID" }, { status: 500 });
    }

    /**
     * ✅ IMPORTANT:
     * Use the incoming request origin FIRST so we never send Stripe back to the wrong domain.
     * (Vercel previews / custom domains / forgesite-seven vs forgesite-ai problems go away.)
     */
    const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "";
    if (!origin) {
      return NextResponse.json(
        { error: "Missing request origin and NEXT_PUBLIC_APP_URL" },
        { status: 500 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: user.email ?? undefined,

      // 🔥 used by webhook to attach entitlement to the Supabase user
      metadata: {
        supabase_user_id: user.id,
      },

      success_url: `${origin}/pro/success?session_id={CHECKOUT_SESSION_ID}&next=${encodeURIComponent(
        next
      )}`,
      cancel_url: `${origin}/billing?next=${encodeURIComponent(next)}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("Checkout error:", err);
    return NextResponse.json({ error: err?.message || "Checkout failed" }, { status: 500 });
  }
}









