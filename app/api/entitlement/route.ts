import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// ✅ IMPORTANT: force dynamic (because we read request.headers)
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

    // ✅ Validate token using service role Supabase client
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    const user = userData?.user;

    if (userErr || !user) return jsonErr("Invalid session", 401);

    // ✅ Fetch entitlement row
    const { data: ent, error: entErr } = await admin
      .from("entitlements")
      .select("status, current_period_end")
      .eq("user_id", user.id)
      .maybeSingle();

    if (entErr) return jsonErr(entErr.message, 500);

    const status = (ent?.status as string | null) || "inactive";

    return NextResponse.json({
      ok: true,
      user_id: user.id,
      status,
      current_period_end: ent?.current_period_end ?? null,
      active: status === "active" || status === "trialing",
    });
  } catch (err: any) {
    return jsonErr(err?.message || "Entitlement route crashed", 500);
  }
}



