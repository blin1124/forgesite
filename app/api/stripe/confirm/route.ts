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

    // Pull session, and expand customer/subscription if possible
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "customer"],
    });

    const userId = (session.metadata?.supabase_user_id || "").trim();
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

    // Subscription might be expanded object, string id, null, or deleted type depending on Stripe typings
    let subscription: any = null;

    if (typeof session.subscription === "string" && session.subscription) {
      subscription = await stripe.subscriptions.retrieve(session.subscription);
    } else if (session.subscription) {
      subscription = session.subscription as any;
    }

    const status: string = subscription?.status ?? "inactive";

    // ✅ Stripe types sometimes don't include current_period_end even though it exists at runtime
    const cpe = subscription?.current_period_end;
    const currentPeriodEnd =
      typeof cpe === "number" ? new Date(cpe * 1000).toISOString() : null;

    // Upsert entitlement (this unlocks middleware gate)
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
        } as any,
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




