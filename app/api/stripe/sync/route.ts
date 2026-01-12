import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Optional utility endpoint:
 * - Lets you “sync” entitlement state for the currently signed-in user.
 * - This is useful if a webhook was delayed/missed, or you want a manual repair button.
 *
 * Expected request JSON:
 * { stripe_customer_id?: string, stripe_subscription_id?: string }
 *
 * Auth:
 * - Uses Authorization: Bearer <supabase access_token>
 */
function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : "";

    if (!token) return jsonError("Auth session missing", 401);

    const supabaseAdmin = getSupabaseAdmin();

    // Validate user from token (service role can do this)
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    const user = userData?.user;

    if (userErr || !user) return jsonError("Invalid session", 401);

    const body = await req.json().catch(() => ({}));
    const stripeCustomerId = String(body?.stripe_customer_id || "").trim();
    const stripeSubscriptionId = String(body?.stripe_subscription_id || "").trim();

    // Pull entitlement row by user_id (preferred)
    const { data: ent, error: entErr } = await supabaseAdmin
      .from("entitlements")
      .select("user_id, email, stripe_customer_id, stripe_subscription_id, status, current_period_end")
      .eq("user_id", user.id)
      .maybeSingle();

    if (entErr) return jsonError(`Entitlements lookup failed: ${entErr.message}`, 500);

    const customerId = stripeCustomerId || String(ent?.stripe_customer_id || "");
    const subscriptionId = stripeSubscriptionId || String(ent?.stripe_subscription_id || "");

    if (!customerId && !subscriptionId) {
      return jsonError(
        "No stripe_customer_id / stripe_subscription_id found. Provide them in request body or ensure webhook wrote entitlements.",
        400
      );
    }

    // If we have subscriptionId, use it to sync status + period end
    let nextStatus: string | null = null;
    let nextCpe: string | null = null;

    if (subscriptionId) {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      nextStatus = sub.status ?? null;
      const cpe = (sub as any).current_period_end;
      nextCpe = cpe ? new Date(cpe * 1000).toISOString() : null;
    } else if (customerId) {
      // Fallback: find the most recent active subscription for this customer
      const subs = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 5,
      });

      const pick = subs.data?.[0];
      if (pick) {
        nextStatus = pick.status ?? null;
        const cpe = (pick as any).current_period_end;
        nextCpe = cpe ? new Date(cpe * 1000).toISOString() : null;
      }
    }

    // Upsert entitlement for this user
    await supabaseAdmin
      .from("entitlements")
      .upsert(
        {
          user_id: user.id,
          email: user.email?.toLowerCase() || null,
          stripe_customer_id: customerId || null,
          stripe_subscription_id: subscriptionId || null,
          status: nextStatus || (ent?.status ?? "inactive"),
          current_period_end: nextCpe || (ent?.current_period_end ?? null),
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: "user_id" } // assumes user_id unique; if yours is different, tell me and I’ll adjust
      );

    return NextResponse.json({
      ok: true,
      user_id: user.id,
      stripe_customer_id: customerId || null,
      stripe_subscription_id: subscriptionId || null,
      status: nextStatus || (ent?.status ?? null),
      current_period_end: nextCpe || (ent?.current_period_end ?? null),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Sync route crashed" },
      { status: 500 }
    );
  }
}





