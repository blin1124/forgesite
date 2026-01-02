import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : "";

    if (!token) {
      return NextResponse.json({ error: "Auth session missing" }, { status: 401 });
    }

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    const user = userData?.user;

    if (userErr || !user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const { session_id } = await req.json().catch(() => ({}));
    if (!session_id) {
      return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
    }

    // Get the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id);

    const customerId = String(session.customer || "");
    const subscriptionId = String(session.subscription || "");
    const email = session.customer_details?.email?.toLowerCase() || user.email?.toLowerCase() || null;

    let status: string | null = null;
    let currentPeriodEnd: string | null = null;

    if (subscriptionId) {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      status = sub.status ?? null;
      const cpe = (sub as any).current_period_end;
      currentPeriodEnd = cpe ? new Date(cpe * 1000).toISOString() : null;
    } else {
      // Fallback: one-time sessions (shouldn’t happen for subscription mode)
      status = "active";
    }

    // Upsert entitlement for this user
    const { error: upsertErr } = await supabaseAdmin
      .from("entitlements")
      .upsert(
        {
          user_id: user.id,
          email,
          stripe_customer_id: customerId || null,
          stripe_subscription_id: subscriptionId || null,
          status: status || "active",
          current_period_end: currentPeriodEnd,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: "user_id" }
      );

    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, status: status || "active" });
  } catch (err: any) {
    console.error("sync error:", err);
    return NextResponse.json({ error: err?.message || "Sync failed" }, { status: 500 });
  }
}
