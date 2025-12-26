import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabase'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const stripeSecret = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!stripeSecret || !webhookSecret) return new NextResponse('Missing Stripe secrets', { status: 500 })
  const stripe = new Stripe(stripeSecret, { apiVersion: '2024-06-20' })
  const body = await req.text()
  const sig = req.headers.get('stripe-signature') as string
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err:any) {
    return new NextResponse(`Webhook signature verification failed: ${err.message}`, { status: 400 })
  }
  const supa = supabaseAdmin()
  try {
    const seatPrice = process.env.STRIPE_SEAT_PRICE_ID
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const email = session.customer_details?.email || session.customer_email
        const subscriptionId = session.subscription as string | null
        const customerId = (session.customer as string) || null
        if (email) {
          let status = 'active'
          let periodEnd: string | null = null
          if (subscriptionId) {
            const sub = await stripe.subscriptions.retrieve(subscriptionId)
            status = sub.status
            periodEnd = new Date(sub.current_period_end * 1000).toISOString()
          }
          // try to find seat subscription item id
          let seatItemId: string | undefined = undefined
          if (subscriptionId && seatPrice) {
            try {
              const sub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ['items.data.price'] })
              const seatItem = sub.items.data.find(it => (it.price as any)?.id === seatPrice)
              if (seatItem) seatItemId = seatItem.id as string
            } catch {}
          }
          await supa.from('entitlements').upsert({
            email,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId ?? null,
            status,
            current_period_end: periodEnd,
            stripe_seat_item_id: seatItemId
          }, { onConflict: 'email' })
        }
        break
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.created':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const customerId = sub.customer as string
        const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer
        const email = customer.email || null
        if (email) {
          // try to find seat subscription item id
          let seatItemId: string | undefined = undefined
          if (subscriptionId && seatPrice) {
            try {
              const sub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ['items.data.price'] })
              const seatItem = sub.items.data.find(it => (it.price as any)?.id === seatPrice)
              if (seatItem) seatItemId = seatItem.id as string
            } catch {}
          }
          await supa.from('entitlements').upsert({
            email,
            stripe_customer_id: customerId,
            stripe_subscription_id: sub.id,
            status: sub.status,
            current_period_end: new Date(sub.current_period_end * 1000).toISOString()
          }, { onConflict: 'email' })
        }
        break
      }
      default: break
    }
    return NextResponse.json({ received: true })
  } catch (e:any) {
    return new NextResponse('Webhook handler error: ' + e.message, { status: 500 })
  }
}
