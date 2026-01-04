import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const session_id = String(body.session_id || "").trim();

    if (!session_id) {
      return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
    }

    // 1) Load checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id);

    // Must be subscription checkout
    if (session.mode !== "subscription") {
      return NextResponse.json({ error: "Not a subscription checkout session" }, { status: 400 });
    }

    const customerId = String(session.customer || "");
    const subscriptionId = String(session.subscription || "");
    const userId = String(session.metadata?.supabase_user_id || "").trim();
    const email =
      (session.customer_details?.email || session.customer_email || "").toLowerCase() || null;

    if (!userId) {
      return NextResponse.json(
        { error: "Missing supabase_user_id in session metadata. (Checkout route must set it.)" },
        { status: 400 }
      );
    }

    // 2) Pull subscription for status + period end
    let status: string | null = null;
    let currentPeriodEnd: string | null = null;

    if (subscriptionId) {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);

      status = (sub as any)?.status ?? null;

      const cpe = (sub as any)?.current_period_end;
      currentPeriodEnd = cpe ? new Date(cpe * 1000).toISOString() : null;
    }

    // 3) Upsert entitlement row for this user (service role bypasses RLS)
    const { error: upErr } = await supabaseAdmin.from("entitlements").upsert(
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

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("confirm route error:", err);
    return NextResponse.json({ error: err?.message || "Confirm failed" }, { status: 500 });
  }
}





