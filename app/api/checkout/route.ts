import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const priceId = process.env.STRIPE_PRICE_ID!;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.headers.get("origin") || "";

    if (!priceId) {
      return NextResponse.json({ error: "Missing STRIPE_PRICE_ID" }, { status: 500 });
    }
    if (!appUrl) {
      return NextResponse.json({ error: "Missing NEXT_PUBLIC_APP_URL (and no Origin header)" }, { status: 500 });
    }

    // ✅ 1) Validate user via Bearer token (fixes “Auth session missing”)
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

    if (!token) {
      return NextResponse.json({ error: "Auth session missing" }, { status: 401 });
    }

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    const user = userData?.user;

    if (userErr || !user) {
      return NextResponse.json({ error: "Auth session missing" }, { status: 401 });
    }

    const email = (user.email || "").toLowerCase();

    // ✅ 2) Find or create Stripe customer
    let customerId: string | null = null;

    // Try entitlements first
    const { data: entRow } = await supabaseAdmin
      .from("entitlements")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (entRow?.stripe_customer_id) customerId = entRow.stripe_customer_id;

    // Try profiles fallback (if you have it)
    if (!customerId) {
      const { data: profRow } = await supabaseAdmin
        .from("profiles")
        .select("stripe_customer_id")
        .eq("id", user.id)
        .maybeSingle();
      if (profRow?.stripe_customer_id) customerId = profRow.stripe_customer_id;
    }

    // Create customer if missing
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: email || undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;

      // Best-effort saves (no .catch chaining)
      try {
        await supabaseAdmin
          .from("profiles")
          .upsert({
            id: user.id,
            stripe_customer_id: customerId,
            updated_at: new Date().toISOString(),
          } as any)
          .throwOnError();
      } catch {}

      try {
        await supabaseAdmin
          .from("entitlements")
          .upsert(
            {
              user_id: user.id,
              email,
              stripe_customer_id: customerId,
              status: "inactive",
              updated_at: new Date().toISOString(),
            } as any,
            { onConflict: "stripe_customer_id" }
          );
      } catch {}
    }

    // ✅ 3) Create Stripe Checkout session (subscription)
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/pro/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/billing?canceled=1`,
      allow_promotion_codes: true,
      metadata: {
        supabase_user_id: user.id,
        supabase_email: email,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Checkout failed" }, { status: 500 });
  }
}







