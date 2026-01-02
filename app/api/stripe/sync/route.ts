import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { session_id } = (await req.json().catch(() => ({}))) as { session_id?: string };

    if (!session_id) {
      return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
    }

    // 1) Pull the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id);

    const customerId = typeof session.customer === "string" ? session.customer : "";
    const subscriptionId = typeof session.subscription === "string" ? session.subscription : "";

    // The user id should be in metadata (you set this in checkout route)
    const userId = (session.metadata?.supabase_user_id || "").trim() || null;

    // Email (optional)
    const email =
      session.customer_details?.email?.toLowerCase() ||
      (typeof session.customer_email === "string" ? session.customer_email.toLowerCase() : null);

    if (!customerId || !subscriptionId) {
      return NextResponse.json(
        { error: "Session missing customer or subscription (did you run mode=subscription?)" },
        { status: 400 }
      );
    }

    // 2) Pull subscription for status + period end
    const sub = await stripe.subscriptions.retrieve(subscriptionId);

    const status = (sub.status || "active") as string;

    // Stripe TS types sometimes lag; access via any
    const cpe = (sub as any).current_period_end as number | undefined;
    const currentPeriodEnd = cpe ? new Date(cpe * 1000).toISOString() : null;

    // 3) Upsert into entitlements
    await supabaseAdmin
      .from("entitlements")
      .upsert(
        {
          user_id: userId,
          email,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          status,
          current_period_end: currentPeriodEnd,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: "stripe_customer_id" }
      );

    // Optional: also update profiles if you use it elsewhere
    if (userId) {
      await supabaseAdmin
        .from("profiles")
        .update({
          subscription_status: status,
          current_period_end: currentPeriodEnd,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
    }

    return NextResponse.json({ ok: true, status, current_period_end: currentPeriodEnd });
  } catch (err: any) {
    console.error("stripe sync error:", err);
    return NextResponse.json({ error: err?.message || "Sync failed" }, { status: 500 });
  }
}



