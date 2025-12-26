
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import Stripe from 'stripe'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { email, token } = await req.json()
    if (!email) return new NextResponse('Missing email', { status: 400 })
    const supa = supabaseAdmin()

    
    let teamId: string | null = null

    if (token) {
      // Token-based acceptance
      const { data: inv, error: eTok } = await supa.from('team_invites').select('*').eq('token', token).eq('status','pending').maybeSingle()
      if (eTok) return new NextResponse('DB error', { status: 500 })
      if (!inv) return new NextResponse('Invite not found or expired', { status: 404 })
      if (new Date(inv.expires_at) < new Date()) return new NextResponse('Invite expired', { status: 410 })
      teamId = inv.team_id
      await supa.from('team_invites').update({ status: 'accepted' }).eq('id', inv.id)
    } else {
      // Email-based bulk acceptance (fallback)
      const { data: invites } = await supa.from('team_invites').select('*').eq('invitee_email', email).eq('status','pending')
      if (invites && invites.length) {
        teamId = invites[0].team_id
        await supa.from('team_invites').update({ status: 'accepted' }).eq('invitee_email', email).eq('status','pending')
      }
    }

    if (!teamId) return NextResponse.json({ ok: true, joined: 0 })

    // Upsert entitlement as member
    await supa.from('entitlements').upsert({ email, team_id: teamId, role: 'member' }, { onConflict: 'email' })

    // Metered billing seat usage record (+1)
    const { data: owner } = await supa.from('entitlements').select('stripe_seat_item_id').eq('team_id', teamId).eq('role','owner').maybeSingle()
    const seatItem = owner?.stripe_seat_item_id
    if (seatItem) {
      try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2024-06-20' })
        await stripe.subscriptionItems.createUsageRecord(seatItem, { quantity: 1, action: 'increment' })
      } catch {}
    }

    return NextResponse.json({ ok: true, joined: 1 })

  } catch (e:any) {
    return new NextResponse(e.message || 'Server error', { status: 500 })
  }
}
