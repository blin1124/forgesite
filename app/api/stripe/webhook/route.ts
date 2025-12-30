// app/api/stripe/webhook/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecret) return new NextResponse("Missing STRIPE_SECRET_KEY", { status: 500 });
  if (!webhookSecret) return new NextResponse("Missing STRIPE_WEBHOOK_SECRET", { status: 500 });

  const stripe = new Stripe(stripeSecret);

  const sig = req.headers.get("stripe-signature");
  if (!sig) return new NextResponse("Missing stripe-signature", { status: 400 });

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    return new NextResponse(`Webhook Error: ${err?.message || "Invalid signature"}`, { status: 400 });
  }

  try {
    // We only care about subscription lifecycle events
    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object as Stripe.Subscription;

      const customerId = String(sub.customer);
      const status = sub.status ?? "canceled";

      // ✅ Fix TS mismatch: access field defensively (Stripe types can differ by version)
      const cpe = (sub as any).current_period_end as number | undefined;
      const currentPeriodEnd = cpe ? new Date(cpe * 1000).toISOString() : null;

      // Try update profiles first
      await supabaseAdmin
        .from("profiles")
        .update({
          stripe_customer_id: customerId,
          subscription_status: status,
          current_period_end: currentPeriodEnd,
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_customer_id", customerId);

      // Also try billing table (if you have it)
      await supabaseAdmin
        .from("billing")
        .upsert(
          {
            stripe_customer_id: customerId,
            subscription_status: status,
            current_period_end: currentPeriodEnd,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "stripe_customer_id" }
        );
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    return new NextResponse(err?.message || "Webhook handler failed", { status: 500 });
  }
}



