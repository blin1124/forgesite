export const runtime = "nodejs"

import Stripe from "stripe"
import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

type RevokeBody = {
  teamId?: string
  userId?: string
}

export async function POST(req: Request) {
  try {
    const stripeSecret = process.env.STRIPE_SECRET_KEY
    if (!stripeSecret) {
      return new NextResponse("Missing STRIPE_SECRET_KEY", { status: 500 })
    }

    const body = (await req.json()) as RevokeBody
    const teamId = body.teamId?.trim()
    const userId = body.userId?.trim()

    if (!teamId) return new NextResponse("Missing teamId", { status: 400 })
    if (!userId) return new NextResponse("Missing userId", { status: 400 })

    // Supabase admin client (yours is a function)
    const admin = supabaseAdmin()

    // Load team owner (or billing record) to find the metered subscription item id
    // Adjust table/fields if your schema differs.
    // Expecting something like: teams(owner_id, stripe_seat_item_id)
    const { data: team, error: teamErr } = await admin
      .from("teams")
      .select("id, owner_id, stripe_seat_item_id")
      .eq("id", teamId)
      .single()

    if (teamErr || !team) {
      console.error("Team lookup error:", teamErr)
      return new NextResponse("Team not found", { status: 404 })
    }

    // Remove member from team_members (adjust if your table differs)
    const { error: delErr } = await admin
      .from("team_members")
      .delete()
      .eq("team_id", teamId)
      .eq("user_id", userId)

    if (delErr) {
      console.error("Team member delete error:", delErr)
      return new NextResponse("Failed to revoke member", { status: 500 })
    }

    // Decrement the seat usage if a metered subscription item is configured
    const seatItemId = (team as any).stripe_seat_item_id as string | undefined

    if (seatItemId) {
      const stripe = new Stripe(stripeSecret, { apiVersion: "2025-12-15.clover" })

      // Use low-level request to avoid SDK method/version differences:
      // POST /v1/subscription_items/{subscription_item}/usage_records
      await (stripe as any).request("POST", `/v1/subscription_items/${seatItemId}/usage_records`, {
        quantity: 1,
        action: "decrement",
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("team/revoke error:", err)
    return new NextResponse("Internal server error", { status: 500 })
  }
}

