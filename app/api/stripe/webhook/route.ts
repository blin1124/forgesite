// app/api/stripe/webhook/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function pickUserIdFromStripeObject(obj: any): string | null {
  // We support multiple places a user id might be stored
  return (
    obj?.metadata?.supabase_user_id ||
    obj?.metadata?.user_id ||
    obj?.client_reference_id ||
    null
  );
}

async function updateProfileByUserId(userId: string, sub: Stripe.Subscription | null) {
  const status = sub?.status ?? "canceled";

  // Stripe typings can differ by apiVersion, so read safely:
  const cpe = (sub as any)?.current_period_end as number | undefined;
  const currentPeriodEnd = cpe ? new Date(cpe * 1000).toISOString() : null;

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      subscription_status: status,
      current_period_end: currentPeriodEnd,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) throw error;
}

async function updateProfileByCustomerId(customerId: string, sub: Stripe.Subscription | null) {
  // Try profiles first (most common)
  const { data: prof, error: e1 } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (e1) throw e1;
  if (prof?.id) return updateProfileByUserId(prof.id, sub);

  // Fallback: if you use a stripe_customers table mapping customer -> user_id
  const { data: cust, error: e2 } = await supabaseAdmin
    .from("stripe_customers")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (e2) throw e2;
  if (cust?.user_id) return updateProfileByUserId(cust.user_id, sub);
}

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Missing STRIPE_WEBHOOK_SECRET" }, { status: 500 });

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook signature error: ${err.message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.mode !== "subscription") break;

        const customerId = session.customer as string | null;
        const subscriptionId = session.subscription as string | null;

        // 1) Prefer userId from session metadata
        const userId = pickUserIdFromStripeObject(session);

        // 2) Fetch the actual subscription and update the profile
        const sub = subscriptionId ? await stripe.subscriptions.retrieve(subscriptionId) : null;

        if (userId) {
          await updateProfileByUserId(userId, sub);
          break;
        }

        if (customerId) {
          await updateProfileByCustomerId(customerId, sub);
          break;
        }

        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string | null;

        // 1) Prefer userId from subscription metadata
        const userId = pickUserIdFromStripeObject(sub);

        if (userId) {
          await updateProfileByUserId(userId, sub);
          break;
        }

        if (customerId) {
          await updateProfileByCustomerId(customerId, sub);
          break;
        }

        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("stripe webhook error:", err);
    return NextResponse.json({ error: err?.message || "Webhook failed" }, { status: 500 });
  }
}




