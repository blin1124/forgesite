import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Stripe webhooks MUST read the raw body for signature verification.
 */
export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json(
      { error: "Missing Stripe signature or STRIPE_WEBHOOK_SECRET" },
      { status: 400 }
    );
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook Error: ${err?.message}` }, { status: 400 });
  }

  try {
    // ✅ 1) checkout completed -> create/activate entitlement
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const customerId = session.customer ? String(session.customer) : null;
      const subscriptionId = session.subscription ? String(session.subscription) : null;
      const userId = (session.metadata?.supabase_user_id || "").trim() || null;
      const email = session.customer_details?.email?.toLowerCase() || session.customer_email?.toLowerCase() || null;

      // Pull subscription info for status + period end
      let status: string | null = "active";
      let currentPeriodEnd: string | null = null;

      if (subscriptionId) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        status = (sub.status as any) ?? "active";
        const cpe = (sub as any).current_period_end;
        currentPeriodEnd = cpe ? new Date(cpe * 1000).toISOString() : null;
      }

      // Write entitlement row
      // NOTE: your table columns (from your screenshot):
      // user_id uuid, email text, stripe_customer_id text, stripe_subscription_id text, status text, current_period_end timestamptz, created_at, updated_at
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
          // use subscription id if present, otherwise customer id
          { onConflict: subscriptionId ? "stripe_subscription_id" : "stripe_customer_id" }
        );
    }

    // ✅ 2) subscription updated/deleted -> keep entitlement in sync
    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;

      const customerId = sub.customer ? String(sub.customer) : null;
      const subscriptionId = sub.id ? String(sub.id) : null;
      const status = (sub.status as any) ?? "canceled";
      const cpe = (sub as any).current_period_end;
      const currentPeriodEnd = cpe ? new Date(cpe * 1000).toISOString() : null;

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
          { onConflict: "stripe_subscription_id" }
        );
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("Webhook handler failed:", err);
    return NextResponse.json({ error: err?.message || "Webhook handler failed" }, { status: 500 });
  }
}





