import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isoFromUnixSeconds(sec?: number | null) {
  if (!sec || typeof sec !== "number") return null;
  return new Date(sec * 1000).toISOString();
}

async function resolveUserIdFromSession(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  session: Stripe.Checkout.Session
) {
  // Preferred: metadata
  const meta = (session.metadata || {}) as Record<string, string | undefined>;

  const userId =
    (meta.supabase_user_id || "").trim() ||
    (meta.user_id || "").trim() ||
    (meta.uid || "").trim() ||
    "";

  if (userId) return userId;

  // Next best: client_reference_id (you set this in checkout route)
  const crid = (session.client_reference_id || "").trim();
  if (crid) return crid;

  // Last resort: if you already store customer->user mapping
  const customerId = String(session.customer || "");
  if (!customerId) return null;

  const { data } = await supabaseAdmin
    .from("stripe_customers")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  return (data?.user_id as string | undefined) || null;
}

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

    // ----------------------------
    // 1) Checkout completed
    // ----------------------------
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const customerId = String(session.customer || "");
      const subscriptionId = String(session.subscription || "");
      const email = session.customer_details?.email?.toLowerCase() || null;

      const userId = await resolveUserIdFromSession(supabaseAdmin, session);

      // If we can't map the user, we can't entitle them.
      // Return 200 so Stripe doesn't keep retrying forever,
      // but you should inspect Stripe Events to see these cases.
      if (!userId) {
        return NextResponse.json({
          received: true,
          warning: "checkout.session.completed: missing user mapping",
          customerId,
          subscriptionId,
          email,
        });
      }

      // Keep a customer mapping table (optional but recommended)
      if (customerId) {
        await supabaseAdmin
          .from("stripe_customers")
          .upsert(
            {
              user_id: userId,
              stripe_customer_id: customerId,
              email,
              updated_at: new Date().toISOString(),
            } as any,
            { onConflict: "stripe_customer_id" }
          );
      }

      // Pull subscription for status + period end
      let status: string | null = null;
      let currentPeriodEnd: string | null = null;

      if (subscriptionId) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        status = sub.status ?? null;
        const cpe = (sub as any).current_period_end as number | undefined;
        currentPeriodEnd = isoFromUnixSeconds(cpe);
      }

      // ✅ Entitlements are keyed by *user_id* (this is what /api/entitlement checks)
      await supabaseAdmin
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
          { onConflict: "user_id" }
        );
    }

    // ----------------------------
    // 2) Subscription updated / deleted
    // ----------------------------
    if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object as Stripe.Subscription;

      const customerId = String(sub.customer || "");
      const subscriptionId = String(sub.id || "");
      const status = sub.status ?? "canceled";

      const cpe = (sub as any).current_period_end as number | undefined;
      const currentPeriodEnd = isoFromUnixSeconds(cpe);

      // Map customer -> user_id (from stripe_customers table)
      let userId: string | null = null;
      if (customerId) {
        const { data } = await supabaseAdmin
          .from("stripe_customers")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        userId = (data?.user_id as string | undefined) || null;
      }

      // If we can't map, still upsert by customer id as a fallback,
      // but your /api/entitlement uses user_id, so mapping is best.
      if (userId) {
        await supabaseAdmin
          .from("entitlements")
          .upsert(
            {
              user_id: userId,
              stripe_customer_id: customerId || null,
              stripe_subscription_id: subscriptionId || null,
              status,
              current_period_end: currentPeriodEnd,
              updated_at: new Date().toISOString(),
            } as any,
            { onConflict: "user_id" }
          );
      } else if (customerId) {
        await supabaseAdmin
          .from("entitlements")
          .upsert(
            {
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId || null,
              status,
              current_period_end: currentPeriodEnd,
              updated_at: new Date().toISOString(),
            } as any,
            { onConflict: "stripe_customer_id" }
          );
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Webhook handler failed" },
      { status: 500 }
    );
  }
}

