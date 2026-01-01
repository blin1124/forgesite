// app/api/checkout/route.ts
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function getAppUrl(req: Request) {
  // Prefer env in prod; fallback to request origin
  return process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
}

export async function POST(req: Request) {
  try {
    const { next } = await req.json().catch(() => ({ next: "/builder" }));

    const supabase = createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    // Ensure profile exists + has stripe_customer_id
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    let customerId = prof?.stripe_customer_id || null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;

      await supabaseAdmin
        .from("profiles")
        .upsert({
          id: user.id,
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString(),
        });
    }

    const appUrl = getAppUrl(req);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
      allow_promotion_codes: true,

      // IMPORTANT: this lets webhook map Stripe -> Supabase user reliably
      metadata: { supabase_user_id: user.id },

      subscription_data: {
        metadata: { supabase_user_id: user.id },
      },

      success_url: `${appUrl}/billing?success=1&next=${encodeURIComponent(next || "/builder")}`,
      cancel_url: `${appUrl}/billing?canceled=1&next=${encodeURIComponent(next || "/builder")}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Checkout error" }, { status: 500 });
  }
}






