
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { owner_email } = await req.json()
    if (!owner_email) return new NextResponse('Missing owner_email', { status: 400 })
    const supa = supabaseAdmin()
    const { data: owner, error: e1 } = await supa.from('entitlements').select('team_id, role').eq('email', owner_email).maybeSingle()
    if (e1 || !owner || owner.role !== 'owner') return new NextResponse('Not owner or no team', { status: 403 })
    const { data: members } = await supa.from('entitlements').select('email, role').eq('team_id', owner.team_id)
    const { data: invites } = await supa.from('team_invites').select('id, invitee_email, status, created_at').eq('team_id', owner.team_id).neq('status','revoked')
    return NextResponse.json({ members: members || [], invites: invites || [] })
  } catch (e:any) {
    return new NextResponse(e.message || 'Server error', { status: 500 })
  }
}
