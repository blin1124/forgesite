
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import Stripe from 'stripe'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { owner_email, invite_id, member_email } = await req.json()
    if (!owner_email) return new NextResponse('Missing owner_email', { status: 400 })
    const supa = supabaseAdmin()
    const { data: owner } = await supa.from('entitlements').select('team_id, role, stripe_seat_item_id').eq('email', owner_email).maybeSingle()
    if (!owner || owner.role !== 'owner') return new NextResponse('Not owner', { status: 403 })

    if (invite_id) {
      await supa.from('team_invites').update({ status: 'revoked' }).eq('id', invite_id).eq('team_id', owner.team_id)
    }
    if (member_email) {
      await supa.from('entitlements').delete().eq('email', member_email).eq('team_id', owner.team_id).eq('role','member')
      if (owner.stripe_seat_item_id) {
        try {
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2024-06-20' })
          await stripe.subscriptionItems.createUsageRecord(owner.stripe_seat_item_id, { quantity: -1, action: 'increment' })
        } catch {}
      }
    }
    return NextResponse.json({ ok: true })
  } catch (e:any) {
    return new NextResponse(e.message || 'Server error', { status: 500 })
  }
}
