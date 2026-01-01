import { NextResponse } from "next/server";
import Stripe from "stripe";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  try {
    const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
    const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID;
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL;

    if (!STRIPE_SECRET_KEY) return jsonError("Missing STRIPE_SECRET_KEY", 500);
    if (!STRIPE_PRICE_ID) return jsonError("Missing STRIPE_PRICE_ID", 500);
    if (!APP_URL) return jsonError("Missing NEXT_PUBLIC_APP_URL", 500);

    // Read optional body for next path (safe default)
    let nextPath = "/builder";
    try {
      const body = await req.json();
      if (body?.next && typeof body.next === "string") {
        nextPath = body.next.startsWith("/") ? body.next : `/${body.next}`;
      }
    } catch {
      // body may be empty — totally fine
    }

    // Supabase server client (uses auth cookie from the browser)
    const cookieStore = cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnon) {
      return jsonError("Missing Supabase public env vars", 500);
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnon, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: "", ...options });
        },
      },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) return jsonError(`Auth error: ${userErr.message}`, 401);
    const user = userData?.user;
    if (!user) return jsonError("Not logged in", 401);

    const stripe = new Stripe(STRIPE_SECRET_KEY);

    const successUrl = `${APP_URL}${nextPath}${nextPath.includes("?") ? "&" : "?"}checkout=success`;
    const cancelUrl = `${APP_URL}/billing?next=${encodeURIComponent(nextPath)}`;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,

      // Helps you match Stripe events back to the logged-in user
      client_reference_id: user.id,
      customer_email: user.email ?? undefined,
      metadata: {
        supabase_user_id: user.id,
        supabase_email: user.email ?? "",
      },
    });

    if (!session.url) return jsonError("Stripe did not return a checkout URL", 500);

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    // Always return JSON (never HTML)
    return NextResponse.json(
      { error: err?.message || "Checkout failed" },
      { status: 500 }
    );
  }
}




