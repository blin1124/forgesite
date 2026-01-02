import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

export async function POST() {
  try {
    /**
     * 1️⃣ Create Supabase server client WITH cookies
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

    /**
     * 2️⃣ Get logged-in user
     */
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;

    if (!user) {
      return NextResponse.json(
        { error: "Auth session missing" },
        { status: 401 }
      );
    }

    /**
     * 3️⃣ Create Stripe Checkout Session
     */
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID!,
          quantity: 1,
        },
      ],
      customer_email: user.email ?? undefined,

      /**
       * 🔑 THIS IS CRITICAL
       * Used later by webhook to unlock access
       */
      metadata: {
        supabase_user_id: user.id,
      },

      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/builder`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
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








