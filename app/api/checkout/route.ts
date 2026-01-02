// app/api/checkout/route.ts
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: userData, error: userErr } = await supabase.auth.getUser();

    const user = userData?.user;
    if (userErr || !user) {
      return NextResponse.json({ error: "Auth session missing" }, { status: 401 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
    const priceId = process.env.STRIPE_PRICE_ID!;
    if (!appUrl) return NextResponse.json({ error: "Missing NEXT_PUBLIC_APP_URL" }, { status: 500 });
    if (!priceId) return NextResponse.json({ error: "Missing STRIPE_PRICE_ID" }, { status: 500 });

    // 1) Find/create Stripe customer
    let customerId: string | null = null;

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    customerId = (prof as any)?.stripe_customer_id ?? null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;

      // Save back to profiles if that table exists (ignore if it doesn't)
      try {
        await supabaseAdmin
          .from("profiles")
          .upsert({
            id: user.id,
            stripe_customer_id: customerId,
            updated_at: new Date().toISOString(),
          })
          .throwOnError();
      } catch {
        // ignore (table might not exist or RLS blocks it)
      }
    }

    // 2) Create checkout session (subscription)
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/pro/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/billing?canceled=1`,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Checkout failed" }, { status: 500 });
  }
}







