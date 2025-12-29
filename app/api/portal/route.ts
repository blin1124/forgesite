import { NextResponse } from "next/server";
import Stripe from "stripe";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

export async function POST(req: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const returnTo =
      typeof body?.returnTo === "string" ? body.returnTo : "http://localhost:3000/billing";

    const { data: row } = await supabase
      .from("stripe_customers")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const customerId = row?.stripe_customer_id;
    if (!customerId) {
      return NextResponse.json(
        { error: "No Stripe customer found. Subscribe first." },
        { status: 400 }
      );
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnTo,
    });

    return NextResponse.json({ url: portal.url });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Portal error" },
      { status: 500 }
    );
  }
}


