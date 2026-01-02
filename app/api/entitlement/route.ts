import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  if (!token) {
    return NextResponse.json({ entitled: false, error: "Auth session missing" }, { status: 401 });
  }

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  const user = userData?.user;

  if (userErr || !user) {
    return NextResponse.json({ entitled: false, error: "Invalid session" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("entitlements")
    .select("status, current_period_end")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ entitled: false, error: error.message }, { status: 500 });
  }

  const status = (data?.status || "").toLowerCase();
  const okStatus = status === "active" || status === "trialing";

  // If current_period_end exists, treat expired subscriptions as not entitled
  const cpe = data?.current_period_end ? new Date(data.current_period_end).getTime() : null;
  const notExpired = cpe == null ? true : cpe > Date.now();

  return NextResponse.json({ entitled: okStatus && notExpired, status: data?.status ?? null });
}



