
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { Resend } from '@resend/node'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { inviter_email, invitee_email } = await req.json()
    if (!inviter_email || !invitee_email) return new NextResponse('Missing emails', { status: 400 })
    const supa = supabaseAdmin()
    const origin = req.headers.get('origin') || 'http://localhost:3000'

    // Find inviter entitlement (must be owner)
    const { data: inviter, error: e1 } = await supa
      .from('entitlements')
      .select('email, role, team_id')
      .eq('email', inviter_email)
      .maybeSingle()
    if (e1) return new NextResponse('DB error', { status: 500 })
    if (!inviter || inviter.role !== 'owner') return new NextResponse('Only team owners can invite', { status: 403 })

    // Upsert pending invite
    const { error: e2 } = await supa.from('team_invites').insert({
      team_id: inviter.team_id,
      inviter_email,
      invitee_email,
      status: 'pending'
    })
    if (e2) return new NextResponse('Could not create invite', { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (e:any) {
    return new NextResponse(e.message || 'Server error', { status: 500 })
  }
}
