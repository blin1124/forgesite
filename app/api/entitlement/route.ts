export const runtime = "nodejs"

import Stripe from "stripe"
import { NextResponse } from "next/server"

function isStripeCustomer(
  customer: Stripe.Checkout.Session["customer"]
): customer is Stripe.Customer {
  return !!customer && typeof customer === "object" && "email" in customer
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { session_id } = body

    if (!session_id) {
      return new NextResponse("Missing session_id", { status: 400 })
    }

    const stripeSecret = process.env.STRIPE_SECRET_KEY
    if (!stripeSecret) {
      return new NextResponse("Missing STRIPE_SECRET_KEY", { status: 500 })
    }

    const stripe = new Stripe(stripeSecret, {
      apiVersion: "2025-12-15.clover",
    })

    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ["line_items", "customer"],
    })

    const email =
      session.customer_details?.email ||
      session.customer_email ||
      (isStripeCustomer(session.customer) ? session.customer.email : null)

    if (!email) {
      return new NextResponse("No email on session", { status: 400 })
    }

    const hasPaid =
      session.payment_status === "paid" || session.status === "complete"

    if (!hasPaid) {
      return new NextResponse("Payment not completed", { status: 403 })
    }

    return NextResponse.json({
      email,
      customerId:
        typeof session.customer === "string"
          ? session.customer
          : session.customer?.id,
      subscriptionId:
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id,
      mode: session.mode,
    })
  } catch (err) {
    console.error("Entitlement error:", err)
    return new NextResponse("Internal server error", { status: 500 })
  }
}


