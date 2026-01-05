import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const sessionId = String(body?.session_id || "");

    if (!sessionId) {
      return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "customer"],
    });

    const userId = session?.metadata?.supabase_user_id;
    if (!userId) {
      return NextResponse.json({ error: "Missing supabase_user_id in session metadata" }, { status: 400 });
    }

    // Resolve subscription object
    let sub: Stripe.Subscription | null = null;

    if (typeof session.subscription === "string") {
      sub = await stripe.subscriptions.retrieve(session.subscription);
    } else if (session.subscription && typeof session.subscription === "object") {
      sub = session.subscription as Stripe.Subscription;
    }

    const status = sub?.status ?? "inactive";
    const currentPeriodEnd =
      typeof (sub as any)?.current_period_end === "number"
        ? new Date((sub as any).current_period_end * 1000).toISOString()
        : null;

    const stripeCustomerId =
      typeof session.customer === "string"
        ? session.customer
        : (session.customer as Stripe.Customer | null)?.id ?? null;

    const stripeSubscriptionId = sub?.id ?? (typeof session.subscription === "string" ? session.subscription : null);

    const email =
      session.customer_details?.email ??
      session.customer_email ??
      null;

    await supabaseAdmin.from("entitlements").upsert(
      {
        user_id: userId,
        email,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        status,
        current_period_end: currentPeriodEnd,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    return NextResponse.json({ ok: true, status });
  } catch (err: any) {
    console.error("stripe confirm error:", err);
    return NextResponse.json({ error: err?.message || "Confirm failed" }, { status: 500 });
  }
}

