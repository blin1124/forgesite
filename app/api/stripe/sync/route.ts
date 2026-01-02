import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function pickToken(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
}

export async function POST(req: Request) {
  try {
    const token = pickToken(req);
    if (!token) return NextResponse.json({ error: "Auth session missing" }, { status: 401 });

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    const user = userData?.user;
    if (userErr || !user) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

    const { session_id } = (await req.json().catch(() => ({}))) as { session_id?: string };
    if (!session_id) return NextResponse.json({ error: "Missing session_id" }, { status: 400 });

    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ["subscription"],
    });

    if (!session) return NextResponse.json({ error: "Checkout session not found" }, { status: 404 });

    // Must be paid for one-time payments; for subscriptions it should still be "paid" when checkout completes.
    if (session.payment_status !== "paid") {
      return NextResponse.json({ error: `Payment not complete (status: ${session.payment_status})` }, { status: 400 });
    }

    const customerId = String(session.customer || "");
    const subscriptionId = String(session.subscription && typeof session.subscription !== "string" ? session.subscription.id : session.subscription || "");

    if (!customerId || !subscriptionId) {
      return NextResponse.json({ error: "Missing customer or subscription on checkout session" }, { status: 400 });
    }

    const sub =
      typeof session.subscription === "string"
        ? await stripe.subscriptions.retrieve(session.subscription)
        : (session.subscription as any);

    const status = String(sub?.status || "active");
    const cpe = sub?.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;

    await supabaseAdmin
      .from("entitlements")
      .upsert(
        {
          user_id: user.id,
          email: (user.email || "").toLowerCase(),
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          status,
          current_period_end: cpe,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: "user_id" }
      );

    return NextResponse.json({ ok: true, status });
  } catch (err: any) {
    console.error("Stripe sync error:", err);
    return NextResponse.json({ error: err?.message || "Sync failed" }, { status: 500 });
  }
}


