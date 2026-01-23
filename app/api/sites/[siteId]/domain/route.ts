import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function jsonErr(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
function jsonOk(payload: any = {}) {
  return NextResponse.json(payload);
}

export async function GET(_req: Request, { params }: { params: { siteId: string } }) {
  try {
    const admin = getSupabaseAdmin();

    const siteId = String(params?.siteId || "").trim();
    if (!siteId) return jsonErr("Missing siteId", 400);

    const { data, error } = await admin
      .from("custom_domains")
      .select("domain,status")
      .eq("site_id", siteId)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (error) return jsonErr(error.message, 400);

    const row = data?.[0];
    const domain = String(row?.domain || "");
    const status = String(row?.status || "");

    return jsonOk({ ok: true, domain, status });
  } catch (e: any) {
    return jsonErr(e?.message || "Failed", 500);
  }
}
