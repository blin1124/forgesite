import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function isActive(status: string | null | undefined) {
  return status === "active" || status === "trialing";
}

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : "";

    if (!token) return jsonError("Missing Authorization Bearer token", 401);

    // ✅ IMPORTANT: get the admin client instance
    const admin = getSupabaseAdmin();

    // ✅ Validate user from JWT
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    const user = userData?.user;

    if (userErr || !user) {
      return jsonError("Invalid session", 401);
    }

    // ✅ Read entitlement row
    const { data: ent, error: entErr } = await admin
      .from("entitlements")
      .select("status, current_period_end")
      .eq("user_id", user.id)
      .maybeSingle();

    if (entErr) return jsonError(entErr.message, 500);

    const status = ent?.status ?? null;
    const active = isActive(status);

    return NextResponse.json({
      user_id: user.id,
      active,
      status,
      current_period_end: ent?.current_period_end ?? null,
    });
  } catch (err: any) {
    console.error("ENTITLEMENT_ROUTE_ERROR:", err);
    return jsonError(err?.message || "Entitlement route crashed", 500);
  }
}



