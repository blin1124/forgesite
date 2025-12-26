import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

async function updateProfileSubscription(params: {
  userId: string;
  status: string;
  currentPeriodEnd: string | null;
}) {
  // Update ONLY columns that exist in your table.
  // From your screenshot you have:
  // - current_period_end
  // - subscription_current_period_end
  // (You can add subscription_status later, but this will work now.)
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      current_period_end: params.currentPeriodEnd,
      subscription_current_period_end: params.currentPeriodEnd,
      // If you add subscription_status column later, uncomment this:
      // subscription_status: params.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.userId);

  if (error) throw error;
}

async function findUserIdFromCustomer(customerId: string) {
  // Your checkout code stores stripe_customer_id in profiles
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (error) throw error;
  return data?.id ?? null;
}

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Missing STRIPE_WEBHOOK_SECRET" }, { status: 500 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  try {
    // We mainly care about subscription lifecycle events
    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object as Stripe.Subscription;

      const customerId = sub.customer as string;
      const status = sub.status ?? "canceled";
      const currentPeriodEnd = sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null;

      // Best: metadata (if you set it)
      const userIdFromMeta = (sub.metadata?.supabase_user_id || sub.metadata?.user_id) ?? null;

      // Fallback: lookup by stripe_customer_id in profiles
      const userId = userIdFromMeta || (await findUserIdFromCustomer(customerId));

      if (!userId) {
        // If you hit this, your checkout route isn't saving stripe_customer_id into profiles
        console.warn("Webhook: could not map customer to user", { customerId });
        return NextResponse.json({ received: true, mapped: false });
      }

      await updateProfileSubscription({ userId, status, currentPeriodEnd });

      return NextResponse.json({ received: true, mapped: true });
    }

    // Also handle checkout completed if you want (optional)
    if (event.type === "checkout.session.completed") {
      // Usually subscription.updated comes right after anyway
      return NextResponse.json({ received: true });
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("Webhook handler error:", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}



