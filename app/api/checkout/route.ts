// app/api/checkout/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const priceId: string =
      body?.priceId || process.env.STRIPE_PRICE_ID || "";

    if (!priceId) {
      return new NextResponse("Missing STRIPE_PRICE_ID", { status: 500 });
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "http://localhost:3000";

    // Get logged-in user from cookies (server client)
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const userId = user.id;
    const email = user.email || undefined;

    // Try to find existing stripe_customer_id (profiles first, then billing)
    let existingCustomerId: string | null = null;

    const prof = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", userId)
      .maybeSingle();

    existingCustomerId = prof.data?.stripe_customer_id ?? null;

    if (!existingCustomerId) {
      const bill = await supabaseAdmin
        .from("billing")
        .select("stripe_customer_id")
        .eq("user_id", userId)
        .maybeSingle();

      existingCustomerId = bill.data?.stripe_customer_id ?? null;
    }

    // Create Stripe customer if missing
    let customerId = existingCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: { user_id: userId },
      });
      customerId = customer.id;

      // Save to profiles (ignore errors if table/column differs)
      try {
        await supabaseAdmin
          .from("profiles")
          .upsert({
            id: userId,
            stripe_customer_id: customerId,
            updated_at: new Date().toISOString(),
          })
          .throwOnError();
      } catch {
        // ignore
      }

      // Also attempt billing table (ignore errors if table/column differs)
      try {
        await supabaseAdmin
          .from("billing")
          .upsert({
            user_id: userId,
            stripe_customer_id: customerId,
            updated_at: new Date().toISOString(),
          })
          .throwOnError();
      } catch {
        // ignore
      }
    }

    // Create checkout session
    const success_url =
      body?.success_url || `${appUrl}/billing?success=1`;
    const cancel_url =
      body?.cancel_url || `${appUrl}/billing?canceled=1`;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId!,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url,
      cancel_url,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { user_id: userId },
      },
      metadata: { user_id: userId },
    } satisfies Stripe.Checkout.SessionCreateParams);

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    return new NextResponse(err?.message || "Checkout error", { status: 500 });
  }
}




