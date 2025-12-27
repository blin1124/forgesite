export const runtime = "nodejs"

import Stripe from "stripe"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const stripeSecret = process.env.STRIPE_SECRET_KEY
    if (!stripeSecret) {
      return new NextResponse("Missing STRIPE_SECRET_KEY", { status: 500 })
    }

    const body = await req.json()
    const seatItem = body?.seatItem as string | undefined

    if (!seatItem) {
      return new NextResponse("Missing seatItem", { status: 400 })
    }

    const stripe = new Stripe(stripeSecret, { apiVersion: "2025-12-15.clover" })

    /**
     * Create a usage record for a metered subscription item.
     * We use a low-level request to avoid SDK method name/version differences.
     *
     * POST /v1/subscription_items/{subscription_item}/usage_records
     */
    await (stripe as any).request("POST", `/v1/subscription_items/${seatItem}/usage_records`, {
      quantity: 1,
      action: "increment",
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("team/accept error:", err)
    return new NextResponse("Internal server error", { status: 500 })
  }
}

