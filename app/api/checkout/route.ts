import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ✅ Always prefer the real request origin first (prevents wrong domain redirects)
function getBaseUrl(req: NextRequest) {
  const origin = req.nextUrl?.origin;
  if (origin) return origin;

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  if (host) return `${proto}://${host}`;

  // last resort fallback
  const env =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL;

  if (env) return env.startsWith("http") ? env : `https://${env}`;

  return "https://www.forgesite.net";
}

export async function POST(req: NextRequest) {
  try {
    // ✅ Expect token from client
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : "";

    if (!token) {
      return NextResponse.json({ error: "Auth session missing" }, { status: 401 });
    }

    // ✅ Validate user using service role client
    const supabaseAdmin = getSupabaseAdmin();
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    const user = userData?.user;

    if (userErr || !user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    // allow passing "next" from BillingClient, fallback /builder
    const body = await req.json().catch(() => ({}));
    const next = typeof body?.next === "string" ? body.next : "/builder";

    const priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId) {
      return NextResponse.json({ error: "Missing STRIPE_PRICE_ID" }, { status: 500 });
    }

    const base = getBaseUrl(req);

    // ✅ Use the success page your app actually has
    // You currently have /pro/success with SuccessClient calling /api/stripe/confirm
    const successUrl =
      `${base}/pro/success?session_id={CHECKOUT_SESSION_ID}` +
      `&next=${encodeURIComponent(next)}`;

    const cancelUrl = `${base}/billing?next=${encodeURIComponent(next)}`;

    // ✅ (Optional but recommended) Reuse existing Stripe customer if you store it
    // This prevents duplicate customers when the same user pays again.
    // If you don't have this table, remove this whole block.
    let existingCustomerId: string | null = null;
    try {
      const { data: row } = await supabaseAdmin
        .from("stripe_customers")
        .select("stripe_customer_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (row?.stripe_customer_id) existingCustomerId = String(row.stripe_customer_id);
    } catch {
      // ignore if table doesn't exist or query fails
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],

      // ✅ If we have a customer, attach it; otherwise Stripe will create one
      ...(existingCustomerId ? { customer: existingCustomerId } : { customer_email: user.email ?? undefined }),

      // ✅ Helps you search in Stripe by your Supabase user id
      client_reference_id: user.id,

      // 🔥 critical for webhook entitlement unlock
      metadata: {
        supabase_user_id: user.id,
        supabase_email: user.email ?? "",
        next_path: next,
      },

      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err: any) {
    console.error("Checkout error:", err);
    return NextResponse.json(
      { error: err?.message || "Checkout failed" },
      { status: 500 }
    );
  }
}










