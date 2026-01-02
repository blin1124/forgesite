import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function POST() {
  try {
    /**
     * 1) Get signed-in Supabase user (server-side)
     */
    const cookieStore = cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;

    if (!user) {
      return NextResponse.json(
        { error: "Auth session missing" },
        { status: 401 }
      );
    }

    const email = user.email?.toLowerCase() || null;

    /**
     * 2) Find or create Stripe customer
     */
    let customerId: string | null = null;

    const { data: existing } = await supabaseAdmin
      .from("entitlements")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing?.stripe_customer_id) {
      customerId = existing.stripe_customer_id;
    } else {
      const customer = await stripe.customers.create({
        email: email || undefined,
        metadata: {
          supabase_user_id: user.id,
        },
      });

      customerId = customer.id;

      // Save customer immediately (entitlement row may be completed by webhook)
      await supabaseAdmin.from("entitlements").upsert(
        {
          user_id: user.id,
          email,
          stripe_customer_id: customerId,
          status: "pending",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    }

    /**
     * 3) Create Stripe Checkout session (SUBSCRIPTION)
     */
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID!,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/builder`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
      metadata: {
        supabase_user_id: user.id, // 🔑 THIS IS THE KEY
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("Checkout error:", err);
    return NextResponse.json(
      { error: err?.message || "Checkout failed" },
      { status: 500 }
    );
  }
}








