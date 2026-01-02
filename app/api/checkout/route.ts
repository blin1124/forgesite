import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const priceId = process.env.STRIPE_PRICE_ID!;
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || req.headers.get("origin") || "";

    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.json(
        { error: "Missing Supabase env (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)" },
        { status: 500 }
      );
    }
    if (!priceId) {
      return NextResponse.json(
        { error: "Missing STRIPE_PRICE_ID" },
        { status: 500 }
      );
    }
    if (!appUrl) {
      return NextResponse.json(
        { error: "Missing NEXT_PUBLIC_APP_URL (and no Origin header)" },
        { status: 500 }
      );
    }

    // ✅ Read the logged-in user from cookies (server-side)
    const cookieStore = cookies();
    const supabase = createServerClient(supabaseUrl, supabaseAnon, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {
          // no-op for this route
        },
        remove() {
          // no-op for this route
        },
      },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    const user = userData?.user;

    if (userErr || !user) {
      return NextResponse.json(
        { error: "Auth session missing" },
        { status: 401 }
      );
    }

    const email = (user.email || "").toLowerCase();

    // ✅ Find or create Stripe customer
    // 1) Try entitlements table first
    let customerId: string | null = null;

    const { data: entRow } = await supabaseAdmin
      .from("entitlements")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (entRow?.stripe_customer_id) {
      customerId = entRow.stripe_customer_id;
    }

    // 2) Try profiles table as fallback (if you keep it)
    if (!customerId) {
      const { data: profRow } = await supabaseAdmin
        .from("profiles")
        .select("stripe_customer_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profRow?.stripe_customer_id) customerId = profRow.stripe_customer_id;
    }

    // 3) Create customer if still missing
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: email || undefined,
        metadata: {
          supabase_user_id: user.id,
        },
      });
      customerId = customer.id;

      // Best effort: write it back (NO .catch chain — Vercel TS hates that here)
      try {
        await supabaseAdmin
          .from("profiles")
          .upsert({
            id: user.id,
            stripe_customer_id: customerId,
            updated_at: new Date().toISOString(),
          })
          .throwOnError();
      } catch {}

      try {
        await supabaseAdmin
          .from("entitlements")
          .upsert(
            {
              user_id: user.id,
              email,
              stripe_customer_id: customerId,
              status: "inactive",
              updated_at: new Date().toISOString(),
            } as any,
            { onConflict: "stripe_customer_id" }
          );
      } catch {}
    }

    // ✅ Create Stripe Checkout session (subscription)
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/pro/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/billing?canceled=1`,
      allow_promotion_codes: true,

      // ✅ THIS is the key “unlock builder after pay” hook:
      metadata: {
        supabase_user_id: user.id,
        supabase_email: email,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Checkout failed" },
      { status: 500 }
    );
  }
}







