import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json(
      { error: "Missing Stripe signature or webhook secret" },
      { status: 400 }
    );
  }

  // Stripe requires raw body for signature verification
  const body = await req.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    return NextResponse.json(
      { error: `Webhook Error: ${err?.message}` },
      { status: 400 }
    );
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();

    // ✅ checkout completed (create entitlement)
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const customerId = String(session.customer || "");
      const subscriptionId = String(session.subscription || "");
      const email = session.customer_details?.email?.toLowerCase() || null;

      // recommended: set in /api/checkout metadata
      const userId =
        (session.metadata?.supabase_user_id || "").trim() || null;

      // Pull subscription to get period end + status
      let status: string | null = null;
      let currentPeriodEnd: string | null = null;

      if (subscriptionId) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        status = sub.status ?? null;
        const cpe = (sub as any).current_period_end;
        currentPeriodEnd = cpe
          ? new Date(cpe * 1000).toISOString()
          : null;
      }

      await supabaseAdmin
        .from("entitlements")
        .upsert(
          {
            user_id: userId,
            email,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            status: status || "active",
            current_period_end: currentPeriodEnd,
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: "stripe_customer_id" }
        );
    }

    // ✅ subscription updated/canceled (keep entitlement in sync)
    if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object as Stripe.Subscription;

      const customerId = String(sub.customer || "");
      const subscriptionId = String(sub.id || "");
      const status = sub.status ?? "canceled";

      const cpe = (sub as any).current_period_end;
      const currentPeriodEnd = cpe
        ? new Date(cpe * 1000).toISOString()
        : null;

      await supabaseAdmin
        .from("entitlements")
        .upsert(
          {
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            status,
            current_period_end: currentPeriodEnd,
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: "stripe_customer_id" }
        );
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Webhook handler failed" },
      { status: 500 }
    );
  }
}






