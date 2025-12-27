export const runtime = "nodejs"

import Stripe from "stripe"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const stripeSecret = process.env.STRIPE_SECRET_KEY
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

    if (!stripeSecret) {
      return new NextResponse("Missing STRIPE_SECRET_KEY", { status: 500 })
    }

    if (!webhookSecret) {
      return new NextResponse("Missing STRIPE_WEBHOOK_SECRET", { status: 500 })
    }

    const stripe = new Stripe(stripeSecret, {
      apiVersion: "2025-12-15.clover",
    })

    const body = await req.text()
    const signature = req.headers.get("stripe-signature")

    if (!signature) {
      return new NextResponse("Missing stripe-signature header", { status: 400 })
    }

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        webhookSecret
      )
    } catch (err) {
      console.error("Stripe webhook signature verification failed:", err)
      return new NextResponse("Invalid signature", { status: 400 })
    }

    // Handle events you care about
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        console.log("checkout.session.completed", {
          id: session.id,
          customer: session.customer,
          subscription: session.subscription,
        })
        break
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription
        console.log(event.type, {
          id: subscription.id,
          status: subscription.status,
        })
        break
      }

      default:
        console.log(`Unhandled Stripe event: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error("Stripe webhook handler error:", err)
    return new NextResponse("Internal server error", { status: 500 })
  }
}

