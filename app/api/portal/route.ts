// app/api/portal/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseRoute } from "@/lib/supabase-server";

export async function POST(req: Request) {
  try {
    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecret) {
      return new NextResponse("Missing STRIPE_SECRET_KEY", { status: 500 });
    }

    const stripe = new Stripe(stripeSecret, {
      // IMPORTANT: prevents the exact Vercel type mismatch you saw earlier
      apiVersion: "2023-10-16",
    });

    const supabase = supabaseRoute();

    // Must be logged in to open billing portal
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // You may store this somewhere else in your DB.
    // This version tries: user_metadata.stripe_customer_id first.
    const customerId =
      (user.user_metadata as any)?.stripe_customer_id ||
      (user.app_metadata as any)?.stripe_customer_id;

    if (!customerId) {
      return new NextResponse(
        "Missing stripe_customer_id for this user (store it on signup/webhook).",
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const return_url =
      body?.return_url ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://forgesite-seven.vercel.app";

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    return new NextResponse(err?.message || "Portal error", { status: 500 });
  }
}



