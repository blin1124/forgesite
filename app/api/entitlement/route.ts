import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function jsonErr(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : "";

    if (!token) return jsonErr("Auth session missing", 401);

    const admin = getSupabaseAdmin();

    // Validate token using service role Supabase client
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    const user = userData?.user;

    if (userErr || !user) return jsonErr("Invalid session", 401);

    // Fetch entitlement row by user_id
    const { data: ent, error: entErr } = await admin
      .from("entitlements")
      .select("status, current_period_end, stripe_customer_id, stripe_subscription_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (entErr) return jsonErr(entErr.message, 500);

    const hasRow = Boolean(ent);
    const status = (ent?.status as string | null) || "inactive";

    const active = status === "active" || status === "trialing";

    return NextResponse.json({
      ok: true,
      user_id: user.id,
      email: user.email ?? null,
      has_row: hasRow,
      status,
      current_period_end: ent?.current_period_end ?? null,
      stripe_customer_id: ent?.stripe_customer_id ?? null,
      stripe_subscription_id: ent?.stripe_subscription_id ?? null,
      active,
    });
  } catch (err: any) {
    return jsonErr(err?.message || "Entitlement route crashed", 500);
  }
}





