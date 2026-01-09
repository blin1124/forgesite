import { NextResponse } from "next/server";
import { getSupabaseAdmin, getUserIdFromRequest } from "../_lib";

export const runtime = "nodejs";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    const user_id = await getUserIdFromRequest(req);

    const { data, error } = await admin
      .from("custom_domains")
      .select("id,user_id,domain,status,verified,dns_records,created_at,updated_at,last_error")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false });

    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ domains: data || [] });
  } catch (e: any) {
    return jsonError(e?.message || "List failed", 500);
  }
}




