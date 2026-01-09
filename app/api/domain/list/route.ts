import { NextResponse } from "next/server";
import { getUserIdFromAuthHeader, supabaseAdmin } from "../_lib";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const admin = supabaseAdmin();
    const user_id = await getUserIdFromAuthHeader(admin, req);
    if (!user_id) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { data, error } = await admin
      .from("custom_domains")
      .select("id, domain, status, verified, dns_records, verification, last_error, created_at, updated_at")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ domains: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "List failed" }, { status: 500 });
  }
}

