import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Confirms a Checkout Session (server-side) and ensures entitlement is active.
 * Called by /pro/success client page.
 *
 * Request JSON: { session_id: string }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const sessionId = String(body?.session_id || "").trim();

    if (!sessionId) return jsonError("Missing session_id", 400);

    const supabaseAdmin = getSupabaseAdmin();

    // Retrieve checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const customerId = String(session.customer || "");
    const subscriptionId = String(session.subscription || "");
    const email = session.customer_details?.email?.toLowerCase() || null;

    const userId = (session.metadata?.supabase_user_id || "").trim() || null;

    if (!customerId) return jsonError("Checkout session missing customer id", 400);

    // Pull subscription status + period end
    let status: string | null = null;
    let currentPeriodEnd: string | null = null;

    if (subscriptionId) {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      status = sub.status ?? null;
      const cpe = (sub as any).current_period_end;
      currentPeriodEnd = cpe ? new Date(cpe * 1000).toISOString() : null;
    }

    // Upsert entitlement
    await supabaseAdmin
      .from("entitlements")
      .upsert(
        {
          user_id: userId, // may be null if you didn't set metadata (but you do)
          email,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId || null,
          status: status || "active",
          current_period_end: currentPeriodEnd,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: "stripe_customer_id" }
      );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("CONFIRM_ROUTE_ERROR:", err);
    return NextResponse.json(
      { error: err?.message || "Confirm route crashed" },
      { status: 500 }
    );
  }
}


