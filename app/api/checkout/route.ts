import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    // Parse input safely
    const body = await req.json().catch(() => ({}));
    const next = typeof body?.next === "string" && body.next.trim() ? body.next : "/builder";

    // Must be logged in
    const supabase = supabaseServer();
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr) {
      return NextResponse.json({ error: authErr.message }, { status: 401 });
    }
    const user = authData?.user;
    if (!user) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    // Env checks
    const priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId) {
      return NextResponse.json(
        { error: "Missing STRIPE_PRICE_ID in .env.local" },
        { status: 500 }
      );
    }

    // HARD VERIFY price exists in the same Stripe mode as your secret key
    // This prevents the “No such price” guessing game.
    try {
      const price = await stripe.prices.retrieve(priceId);
      if (!price || price.deleted) {
        return NextResponse.json(
          { error: `Stripe price not found or deleted: ${priceId}` },
          { status: 500 }
        );
      }
    } catch (e: any) {
      // This is the exact error you were seeing. Now it returns a clear response.
      return NextResponse.json(
        {
          error:
            `Stripe cannot retrieve STRIPE_PRICE_ID="${priceId}". ` +
            `This almost always means your STRIPE_SECRET_KEY is in a different mode/account than the price. ` +
            `Details: ${e?.message || "Unknown Stripe error"}`,
        },
        { status: 500 }
      );
    }

    // Find existing mapping in stripe_customers (this is what your webhook uses)
    const { data: existing, error: existingErr } = await supabaseAdmin
      .from("stripe_customers")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingErr) {
      return NextResponse.json({ error: existingErr.message }, { status: 500 });
    }

    let customerId = existing?.stripe_customer_id ?? null;

    // Create Stripe customer if needed
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        metadata: { supabase_user_id: user.id },
      });

      customerId = customer.id;

      const { error: insErr } = await supabaseAdmin
        .from("stripe_customers")
        .insert({
          user_id: user.id,
          stripe_customer_id: customerId,
          email: user.email || null,
        });

      if (insErr) {
        return NextResponse.json(
          { error: `Failed to insert stripe_customers row: ${insErr.message}` },
          { status: 500 }
        );
      }

      // Optional: also store on profiles if you want
      await supabaseAdmin.from("profiles").upsert({
        id: user.id,
        stripe_customer_id: customerId,
        updated_at: new Date().toISOString(),
      });
    }

    // Create Checkout session
    const origin = new URL(req.url).origin;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/billing?success=1&next=${encodeURIComponent(next)}`,
      cancel_url: `${origin}/billing?canceled=1&next=${encodeURIComponent(next)}`,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { supabase_user_id: user.id },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Checkout error" },
      { status: 500 }
    );
  }
}


