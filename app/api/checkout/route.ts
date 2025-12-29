import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

async function upsertCustomer(userId: string, email?: string | null) {
  // Try profiles first (recommended), otherwise billing table
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .maybeSingle();

  const existing = profile?.stripe_customer_id;
  if (existing) return existing;

  const customer = await stripe.customers.create({
    email: email || undefined,
    metadata: { supabase_user_id: userId },
  });

  // Write to profiles if it exists; ignore errors if table differs
  await supabaseAdmin
    .from("profiles")
    .upsert({ id: userId, stripe_customer_id: customer.id, updated_at: new Date().toISOString() })
    .throwOnError()
    .catch(() => {});

  // Also attempt billing table for people using option B
  await supabaseAdmin
    .from("billing")
    .upsert({ user_id: userId, stripe_customer_id: customer.id, updated_at: new Date().toISOString() })
    .catch(() => {});

  return customer.id;
}

export async function POST(req: Request) {
  try {
    const { next } = await req.json().catch(() => ({ next: "/builder" }));

    const supabase = createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    const user = data?.user;

    if (!user) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const customerId = await upsertCustomer(user.id, user.email);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${getAppUrl()}/billing/success?next=${encodeURIComponent(next || "/builder")}`,
      cancel_url: `${getAppUrl()}/billing?next=${encodeURIComponent(next || "/builder")}`,
      metadata: { supabase_user_id: user.id },
      subscription_data: {
        metadata: { supabase_user_id: user.id },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Checkout error" }, { status: 500 });
  }
}



