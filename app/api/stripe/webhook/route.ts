import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function isActiveStatus(status: string | null | undefined) {
  return status === "active" || status === "trialing";
}

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json(
      { error: "Missing Stripe signature or STRIPE_WEBHOOK_SECRET" },
      { status: 400 }
    );
  }

  // IMPORTANT: raw body required for signature verification
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    return NextResponse.json(
      { error: `Signature verification failed: ${err?.message}` },
      { status: 400 }
    );
  }

  try {
    // 1) Checkout completed => subscription created/active/trialing
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const userId = (session.metadata?.supabase_user_id || "").trim();
      const customerId = String(session.customer || "");
      const subscriptionId = String(session.subscription || "");
      const email = session.customer_details?.email?.toLowerCase() || null;

      // Your entitlements table has user_id NOT NULL -> we require metadata
      if (!userId) {
        return NextResponse.json(
          { error: "Missing metadata.supabase_user_id on checkout session" },
          { status: 400 }
        );
      }

      let status: string | null = null;
      let currentPeriodEnd: string | null = null;

      if (subscriptionId) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        status = sub.status ?? null;
        const cpe = (sub as any).current_period_end;
        currentPeriodEnd = cpe ? new Date(cpe * 1000).toISOString() : null;
      }

      const write = await supabaseAdmin
        .from("entitlements")
        .upsert(
          {
            user_id: userId,
            email,
            stripe_customer_id: customerId || null,
            stripe_subscription_id: subscriptionId || null,
            status: status || "active",
            current_period_end: currentPeriodEnd,
            updated_at: new Date().toISOString(),
          } as any,
          // IMPORTANT: make sure you have a UNIQUE constraint on user_id (see SQL below)
          { onConflict: "user_id" }
        )
        .select("user_id,status,current_period_end")
        .single();

      if (write.error) {
        return NextResponse.json(
          { error: `Supabase write failed: ${write.error.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json({ ok: true });
    }

    // 2) Subscription updated/deleted => keep entitlements in sync
    if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object as Stripe.Subscription;

      const customerId = String(sub.customer || "");
      const subscriptionId = String(sub.id || "");
      const status = sub.status ?? "canceled";
      const cpe = (sub as any).current_period_end;
      const currentPeriodEnd = cpe ? new Date(cpe * 1000).toISOString() : null;

      // If you store customer->user mapping elsewhere, update by that.
      // Easiest: keep using the user_id row created by checkout.session.completed.
      // Here we update rows that match the customer id (optional),
      // but user_id is the real key for gating.
      const upd = await supabaseAdmin
        .from("entitlements")
        .update({
          stripe_subscription_id: subscriptionId || null,
          status,
          current_period_end: currentPeriodEnd,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("stripe_customer_id", customerId);

      if (upd.error) {
        return NextResponse.json(
          { error: `Supabase update failed: ${upd.error.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json({ ok: true });
    }

    // ignore other events
    return NextResponse.json({ received: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Webhook handler failed" },
      { status: 500 }
    );
  }
}






