import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !serviceRole) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, serviceRole, {
    auth: { persistSession: false },
  });
}

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY!;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  return new Stripe(key, {
    // keep this simple; don’t pin to a typed apiVersion string that causes build failures
    apiVersion: "2025-12-15.clover",
  } as any);
}

export async function POST(req: Request) {
  try {
    const stripe = getStripe();
    const supabaseAdmin = getAdminSupabase();

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : "";

    if (!token) {
      return new NextResponse("Auth session missing!", { status: 401 });
    }

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user?.id) {
      return new NextResponse("Auth session missing!", { status: 401 });
    }

    const user = userData.user;

    // Optional body: { next: "/builder" }
    let nextPath = "/builder";
    try {
      const body = await req.json();
      if (body?.next) nextPath = String(body.next);
    } catch {
      // ignore if no JSON body
    }

    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      req.headers.get("origin") ||
      "https://forgesite-seven.vercel.app";

    const priceId = process.env.STRIPE_PRICE_ID!;
    if (!priceId) throw new Error("Missing STRIPE_PRICE_ID");

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}${nextPath}?checkout=success`,
      cancel_url: `${origin}/billing?checkout=cancel`,
      customer_email: user.email ?? undefined,
      metadata: {
        user_id: user.id,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Checkout failed" },
      { status: 500 }
    );
  }
}





