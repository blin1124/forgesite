// app/api/stripe/portal/route.ts
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const returnUrl =
      body?.returnUrl ||
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "http://localhost:3000/billing";

    const supabase = supabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Find stripe_customer_id (profiles first, then billing)
    let customerId: string | null = null;

    const prof = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    customerId = prof.data?.stripe_customer_id ?? null;

    if (!customerId) {
      const bill = await supabaseAdmin
        .from("billing")
        .select("stripe_customer_id")
        .eq("user_id", user.id)
        .maybeSingle();

      customerId = bill.data?.stripe_customer_id ?? null;
    }

    if (!customerId) {
      return new NextResponse("No Stripe customer found for user", { status: 400 });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    return new NextResponse(err?.message || "Portal error", { status: 500 });
  }
}



