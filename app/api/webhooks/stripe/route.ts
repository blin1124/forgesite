import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function jsonErr(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function resolveUserIdFromSession(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  session: Stripe.Checkout.Session
) {
  // 1) Best: metadata set by your checkout route
  const metaUser =
    (session.metadata?.supabase_user_id || session.metadata?.user_id || "").trim() || "";
  if (metaUser) return metaUser;

  // 2) Next: map from stripe_customer_id via your stripe_customers table
  const customerId = String(session.customer || "").trim();
  if (customerId) {
    const { data } = await supabaseAdmin
      .from("stripe_customers")
      .select("user_id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();

    if (data?.user_id) return String(data.user_id);
  }

  // 3) Last: map by email to profiles (ONLY if your app stores profiles by auth user_id and email)
  const email =
    (session.customer_details?.email || session.customer_email || "").toLowerCase().trim();

  if (email) {
    // If you have a profiles table that stores email, try it.
    // If not, remove this block.
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if ((data as any)?.id) return String((data as any).id);
  }

  return null;
}

async function upsertEntitlementByUserId(params: {
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
  email: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  status: string;
  currentPeriodEnd: string | null;
}) {
  const {
    supabaseAdmin,
    userId,
    email,
    stripeCustomerId,
    stripeSubscriptionId,
    status,
    currentPeriodEnd,
  } = params;

  // Upsert keyed by user_id so /api/entitlement can find it reliably
  await supabaseAdmin
    .from("entitlements")
    .upsert(
      {
        user_id: userId,
        email,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        status,
        current_period_end: currentPeriodEnd,
        updated_at: new Date().toISOString(),
      } as any,
      { onConflict: "user_id" }
    );
}

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return jsonErr("Missing Stripe signature or webhook secret", 400);
  }

  // Stripe requires raw body
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    return jsonErr(`Webhook Error: ${err?.message}`, 400);
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();

    // ===========================
    // checkout.session.completed
    // ===========================
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const stripeCustomerId = String(session.customer || "").trim() || null;
      const stripeSubscriptionId = String(session.subscription || "").trim() || null;

      const email =
        (session.customer_details?.email || session.customer_email || "")
          .toLowerCase()
          .trim() || null;

      const userId = await resolveUserIdFromSession(supabaseAdmin, session);

      // Pull subscription status + period end (if available)
      let status = "active";
      let currentPeriodEnd: string | null = null;

      if (stripeSubscriptionId) {
        const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
        status = sub.status ?? "active";

        const cpe = (sub as any).current_period_end;
        currentPeriodEnd = cpe ? new Date(cpe * 1000).toISOString() : null;
      }

      if (userId) {
        await upsertEntitlementByUserId({
          supabaseAdmin,
          userId,
          email,
          stripeCustomerId,
          stripeSubscriptionId,
          status,
          currentPeriodEnd,
        });
      } else {
        // We cannot unlock without mapping to a user — store a breadcrumb to debug
        await supabaseAdmin.from("last_error").insert({
          scope: "stripe_webhook",
          message: "checkout.session.completed but could not resolve user_id",
          payload: {
            stripeCustomerId,
            stripeSubscriptionId,
            email,
            metadata: session.metadata || null,
          },
          created_at: new Date().toISOString(),
        } as any);
      }
    }

    // ======================================
    // customer.subscription.updated/deleted
    // ======================================
    if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object as Stripe.Subscription;

      const stripeCustomerId = String(sub.customer || "").trim() || null;
      const stripeSubscriptionId = String(sub.id || "").trim() || null;
      const status = sub.status ?? "canceled";

      const cpe = (sub as any).current_period_end;
      const currentPeriodEnd = cpe ? new Date(cpe * 1000).toISOString() : null;

      if (stripeCustomerId) {
        // Map customer -> user via stripe_customers table
        const supabaseAdmin = getSupabaseAdmin();
        const { data } = await supabaseAdmin
          .from("stripe_customers")
          .select("user_id, email")
          .eq("stripe_customer_id", stripeCustomerId)
          .maybeSingle();

        const userId = data?.user_id ? String(data.user_id) : null;
        const email = (data as any)?.email ? String((data as any).email) : null;

        if (userId) {
          await upsertEntitlementByUserId({
            supabaseAdmin,
            userId,
            email,
            stripeCustomerId,
            stripeSubscriptionId,
            status,
            currentPeriodEnd,
          });
        }
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


