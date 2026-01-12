import { requireUserId, jsonOk, jsonErr } from "../_lib";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const user_id = await requireUserId(req);
    const admin = getSupabaseAdmin();

    const { data, error } = await admin
      .from("custom_domains")
      .select("*")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false });

    if (error) return jsonErr(error.message, 500);

    return jsonOk({ domains: data || [] });
  } catch (e: any) {
    return jsonErr(e?.message || "List failed", 500);
  }
}






