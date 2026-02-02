import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    // ✅ checkout completed (create/update entitlement)
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const customerId = String(session.customer || "");
      const subscriptionId = String(session.subscription || "");
      const email = session.customer_details?.email?.toLowerCase() || null;

      // ✅ MUST match what we set in /api/stripe/checkout metadata
      const userId = (session.metadata?.supabase_user_id || "").trim() || null;

      // If Stripe hasn't attached these yet, don't write bad rows
      if (!customerId || !subscriptionId) {
        return NextResponse.json({ received: true, skipped: "missing ids" });
      }

      // Pull subscription to get period end + status
      let status: string | null = null;
      let currentPeriodEnd: string | null = null;

      try {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        status = sub.status ?? null;
        const cpe = (sub as any).current_period_end;
        currentPeriodEnd = cpe ? new Date(cpe * 1000).toISOString() : null;
      } catch {
        // If subscription lookup fails, still write something sane
        status = status || "active";
      }

      // Only set user_id if we actually have it (prevents overwriting a good user_id with null)
      const payload: Record<string, any> = {
        email,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        status: status || "active",
        current_period_end: currentPeriodEnd,
        updated_at: new Date().toISOString(),
      };
      if (userId) payload.user_id = userId;

      await supabaseAdmin
        .from("entitlements")
        .upsert(payload as any, { onConflict: "stripe_customer_id" });
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

      if (!customerId || !subscriptionId) {
        return NextResponse.json({ received: true, skipped: "missing ids" });
      }

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
          { onConflict: "stripe_customer_id" }
        );
    }

    // (Optional) handle invoice.payment_failed if you want to mark status past_due
    // if (event.type === "invoice.payment_failed") { ... }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Webhook handler failed" },
      { status: 500 }
    );
  }
}







