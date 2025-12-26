import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabase'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const session_id = req.nextUrl.searchParams.get('session_id')
    if (!session_id) return new NextResponse('Missing session_id', { status: 400 })
    const stripeSecret = process.env.STRIPE_SECRET_KEY
    if (!stripeSecret) return new NextResponse('Missing STRIPE_SECRET_KEY', { status: 500 })
    const stripe = new Stripe(stripeSecret, { apiVersion: '2024-06-20' })
    const session = await stripe.checkout.sessions.retrieve(session_id)
    const email = session.customer_details?.email || session.customer_email
    if (!email) return new NextResponse('No email on session', { status: 400 })
    const supa = supabaseAdmin()
    const { data, error } = await supa.from('entitlements').select('*').eq('email', email).maybeSingle()
    if (error) return new NextResponse('DB error', { status: 500 })
    const active = !!(data && ['active','trialing','past_due'].includes(data.status) && (!data.current_period_end || new Date(data.current_period_end) > new Date()))
    if (!active) return new NextResponse('No active subscription found', { status: 403 })
    return NextResponse.json({ ok: true, email })
  } catch (e:any) {
    return new NextResponse(e.message || 'Server error', { status: 500 })
  }
}
