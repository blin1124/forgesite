import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function isActive(status: string | null | undefined) {
  return status === "active" || status === "trialing";
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const sessionId = body?.session_id;

    if (!sessionId) {
      return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
    }

    // Retrieve checkout session + subscription
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "customer"],
    });

    const userId = session.metadata?.supabase_user_id;
    if (!userId) {
      return NextResponse.json(
        { error: "Missing supabase_user_id in session metadata" },
        { status: 400 }
      );
    }

    const customerId =
      typeof session.customer === "string"
        ? session.customer
        : session.customer?.id ?? null;

    const subscription =
      typeof session.subscription === "string"
        ? await stripe.subscriptions.retrieve(session.subscription)
        : session.subscription;

    const status = subscription?.status ?? "inactive";
    const currentPeriodEnd = subscription?.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null;

    // 🔥 THIS is what unlocks the Builder
    const { error } = await supabaseAdmin
      .from("entitlements")
      .upsert(
        {
          user_id: userId,
          email: session.customer_details?.email?.toLowerCase() ?? null,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription?.id ?? null,
          status: isActive(status) ? status : "inactive",
          current_period_end: currentPeriodEnd,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (error) {
      console.error("Entitlement upsert failed:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Confirm error:", err);
    return NextResponse.json(
      { error: err?.message || "Confirm failed" },
      { status: 500 }
    );
  }
}
