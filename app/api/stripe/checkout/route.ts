import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { next } = await req.json().catch(() => ({ next: "/builder" }));

    // Authenticated user (cookie-based)
    const supabase = supabaseServer();
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    if (authErr) {
      return NextResponse.json({ error: authErr.message }, { status: 401 });
    }
    const user = auth?.user;
    if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

    // Price ID required
    const priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId) {
      return NextResponse.json({ error: "Missing STRIPE_PRICE_ID" }, { status: 500 });
    }

    // Get/create Stripe customer using PROFILES (matches your middleware gating)
    const { data: profile, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profErr) {
      return NextResponse.json({ error: profErr.message }, { status: 500 });
    }

    let customerId = profile?.stripe_customer_id ?? null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        metadata: { supabase_user_id: user.id },
      });

      customerId = customer.id;

      const { error: upsertErr } = await supabaseAdmin
        .from("profiles")
        .upsert({
          id: user.id,
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString(),
        });

      if (upsertErr) {
        return NextResponse.json({ error: upsertErr.message }, { status: 500 });
      }
    }

    const origin = new URL(req.url).origin;
    const safeNext = typeof next === "string" && next.length > 0 ? next : "/builder";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/billing?success=1&next=${encodeURIComponent(safeNext)}`,
      cancel_url: `${origin}/billing?canceled=1&next=${encodeURIComponent(safeNext)}`,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { supabase_user_id: user.id },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Checkout error" }, { status: 500 });
  }
}




