import { requireUserId, supabaseAdmin, jsonOk, jsonErr } from "../_lib";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user_id = await requireUserId();
    const admin = supabaseAdmin();

    const { data, error } = await admin
      .from("custom_domains")
      .select("id, site_id, domain, status, verified, dns_records, verification, created_at, updated_at")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return jsonOk({ domains: data || [] });
  } catch (e: any) {
    return jsonErr(e?.message || "List failed", 500);
  }
}



