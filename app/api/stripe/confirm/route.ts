import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-12-15.clover",
});

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const sessionId = String(body?.session_id || "").trim();

    if (!sessionId) {
      return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Fetch Checkout Session (expand subscription so we can read status/period end)
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    const customerId = String(session.customer || "");
    const subscriptionId = String(session.subscription || "");
    const email = session.customer_details?.email?.toLowerCase() || null;

    // ✅ Pull user id from metadata (this is why Step 2A mattered)
    const userId = (session.metadata?.supabase_user_id || "").trim() || null;

    if (!customerId || !subscriptionId) {
      return NextResponse.json(
        { error: "Missing customer/subscription on session" },
        { status: 400 }
      );
    }

    // Determine subscription status + period end
    let status: string | null = null;
    let currentPeriodEnd: string | null = null;

    const subObj = session.subscription as Stripe.Subscription | null;
    if (subObj) {
      status = subObj.status ?? null;
      const cpe = (subObj as any).current_period_end;
      currentPeriodEnd = cpe ? new Date(cpe * 1000).toISOString() : null;
    } else {
      // fallback
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      status = sub.status ?? null;
      const cpe = (sub as any).current_period_end;
      currentPeriodEnd = cpe ? new Date(cpe * 1000).toISOString() : null;
    }

    // Require active/trialing to unlock builder
    const ok = status === "active" || status === "trialing";
    if (!ok) {
      return NextResponse.json(
        { error: `Subscription not active (${status || "unknown"})` },
        { status: 402 }
      );
    }

    // Upsert entitlement so builder immediately recognizes it
    // NOTE: keeps your existing onConflict behavior
    await supabaseAdmin
      .from("entitlements")
      .upsert(
        {
          user_id: userId,
          email,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          status: status || "active",
          current_period_end: currentPeriodEnd,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: "stripe_customer_id" }
      );

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Confirm failed" },
      { status: 500 }
    );
  }
}





