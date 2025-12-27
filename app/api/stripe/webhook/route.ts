export const runtime = "nodejs"

import Stripe from "stripe"
import { NextResponse } from "next/server"

const stripeSecret = process.env.STRIPE_SECRET_KEY
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

const stripe = stripeSecret
  ? new Stripe(stripeSecret, { apiVersion: "2025-12-15.clover" })
  : null

function isStripeCustomer(
  customer: Stripe.Checkout.Session["customer"]
): customer is Stripe.Customer {
  return !!customer && typeof customer === "object" && "email" in customer
}

export async function POST(req: Request) {
  try {
    if (!stripe) return new NextResponse("Missing STRIPE_SECRET_KEY", { status: 500 })
    if (!webhookSecret) return new NextResponse("Missing STRIPE_WEBHOOK_SECRET", { status: 500 })

    const rawBody = await req.text()
    const signature = req.headers.get("stripe-signature")
    if (!signature) return new NextResponse("Missing stripe-signature header", { status: 400 })

    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err?.message || err)
      return new NextResponse("Invalid signature", { status: 400 })
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session

        const email =
          session.customer_details?.email ||
          session.customer_email ||
          (isStripeCustomer(session.customer) ? session.customer.email : null)

        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id

        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id

        console.log("checkout.session.completed", {
          email,
          customerId,
          subscriptionId,
          mode: session.mode,
          payment_status: session.payment_status,
        })

        return NextResponse.json({ received: true })
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription

        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer.id

        const status = sub.status

        // ✅ FIX: do NOT access sub.current_period_end directly (typing mismatch)
        const currentPeriodEnd =
          typeof (sub as any).current_period_end === "number"
            ? new Date(((sub as any).current_period_end as number) * 1000).toISOString()
            : null

        console.log(event.type, {
          customerId,
          status,
          currentPeriodEnd,
          cancel_at_period_end: sub.cancel_at_period_end,
        })

        return NextResponse.json({ received: true })
      }

      default:
        console.log("Unhandled Stripe event:", event.type)
        return NextResponse.json({ received: true })
    }
  } catch (err) {
    console.error("Stripe webhook handler error:", err)
    return new NextResponse("Server error", { status: 500 })
  }
}



