// app/api/checkout/route.ts
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function appUrl(req: Request) {
  return process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const next = typeof body?.next === "string" ? body.next : "/builder";

    // ✅ This MUST read the Supabase auth cookie on the server
    const supabase = createSupabaseServerClient();
    const { data: userData, error: userErr } = await supabase.auth.getUser();

    if (userErr || !userData?.user) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const user = userData.user;

    // Ensure we have a Stripe customer id stored
    const { data: prof, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 });

    let customerId = prof?.stripe_customer_id || null;

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

      if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }

    const url = appUrl(req);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
      allow_promotion_codes: true,

      // ✅ helps webhooks map Stripe -> Supabase user
      metadata: { supabase_user_id: user.id },
      subscription_data: { metadata: { supabase_user_id: user.id } },

      success_url: `${url}/billing?success=1&next=${encodeURIComponent(next)}`,
      cancel_url: `${url}/billing?canceled=1&next=${encodeURIComponent(next)}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Checkout failed" }, { status: 500 });
  }
}







