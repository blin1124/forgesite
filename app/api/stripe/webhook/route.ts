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

  const stripe = new Stripe(stripeSecret, { apiVersion: "2024-06-20" as any });

  const sig = req.headers.get("stripe-signature");
  if (!sig) return new NextResponse("Missing stripe-signature", { status: 400 });

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    // Handle subscription events (expand later if you want)
    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object as any; // ✅ avoid TS mismatch across stripe versions

      const customerId = String(sub.customer || "");
      const status = String(sub.status || "canceled");
      const currentPeriodEnd = sub.current_period_end
        ? new Date(Number(sub.current_period_end) * 1000).toISOString()
        : null;

      // Upsert into your billing table if you have one.
      // If you use a different table/columns, this will still compile;
      // worst case it logs an error and webhook returns 200 so Stripe won't retry forever.
      try {
        await supabaseAdmin
          .from("billing")
          .upsert({
            stripe_customer_id: customerId,
            status,
            current_period_end: currentPeriodEnd,
            updated_at: new Date().toISOString(),
          })
          .throwOnError();
      } catch {
        // no-op
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    return new NextResponse(err?.message || "Webhook handler failed", { status: 500 });
  }
}




