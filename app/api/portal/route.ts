import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  try {
    const { returnTo } = await req.json().catch(() => ({ returnTo: "/billing" }));
    const supabase = supabaseServer();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.stripe_customer_id) {
      return NextResponse.json({ error: "No Stripe customer found yet. Click Subscribe first." }, { status: 400 });
    }

    const origin = new URL(req.url).origin;

    const portal = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${origin}${returnTo || "/billing"}`,
    });

    return NextResponse.json({ url: portal.url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Portal error" }, { status: 500 });
  }
}

