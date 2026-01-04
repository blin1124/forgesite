import { NextResponse } from "next/server";
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

    // 1) Load checkout session
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.mode !== "subscription") {
      return NextResponse.json({ error: "Not a subscription checkout session" }, { status: 400 });
    }

    const userId = String(session.metadata?.supabase_user_id || "").trim();
    if (!userId) {
      return NextResponse.json(
        { error: "Missing metadata.supabase_user_id (checkout route must set it)" },
        { status: 400 }
      );
    }

    const customerId = session.customer ? String(session.customer) : null;
    const subscriptionId = session.subscription ? String(session.subscription) : null;

    const email =
      (session.customer_details?.email || session.customer_email || "").toLowerCase() || null;

    // 2) Get subscription status + current period end
    let status: string | null = null;
    let currentPeriodEnd: string | null = null;

    if (subscriptionId) {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      status = (sub as any)?.status ?? null;

      const cpe = (sub as any)?.current_period_end;
      currentPeriodEnd = cpe ? new Date(cpe * 1000).toISOString() : null;
    }

    const payload: any = {
      user_id: userId,
      email,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      status: status || "active",
      current_period_end: currentPeriodEnd,
      updated_at: new Date().toISOString(),
    };

    // 3) Update if exists, else insert
    const { data: existing, error: selErr } = await supabaseAdmin
      .from("entitlements")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (selErr) {
      return NextResponse.json({ error: `Entitlements select failed: ${selErr.message}` }, { status: 500 });
    }

    if (existing?.user_id) {
      const { error: updErr } = await supabaseAdmin
        .from("entitlements")
        .update(payload)
        .eq("user_id", userId);

      if (updErr) {
        return NextResponse.json({ error: `Entitlements update failed: ${updErr.message}` }, { status: 500 });
      }
    } else {
      const { error: insErr } = await supabaseAdmin
        .from("entitlements")
        .insert(payload);

      if (insErr) {
        return NextResponse.json({ error: `Entitlements insert failed: ${insErr.message}` }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, user_id: userId, status: payload.status });
  } catch (err: any) {
    console.error("confirm route error:", err);
    return NextResponse.json({ error: err?.message || "Confirm failed" }, { status: 500 });
  }
}
