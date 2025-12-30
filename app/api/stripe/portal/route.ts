// app/api/stripe/portal/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const userId = String(body.userId || "").trim();

    if (!userId) return new NextResponse("Missing userId", { status: 400 });

    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecret) return new NextResponse("Missing STRIPE_SECRET_KEY", { status: 500 });

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.NEXT_PUBLIC_VERCEL_URL
        ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
        : "http://localhost:3000");

    const stripe = new Stripe(stripeSecret, {
      apiVersion: "2024-06-20" as any,
    });

    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", userId)
      .single();

    if (error) return new NextResponse(error.message, { status: 500 });

    const customerId = profile?.stripe_customer_id;
    if (!customerId) return new NextResponse("No stripe_customer_id for user", { status: 400 });

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/billing`,
    });

    return NextResponse.json({ url: portal.url });
  } catch (err: any) {
    return new NextResponse(err?.message || "Portal failed", { status: 500 });
  }
}




