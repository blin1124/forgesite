import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function normalizeDomain(raw: string) {
  const s = (raw || "").trim().toLowerCase();
  if (!s) return "";
  return s.replace(/^https?:\/\//, "").split("/")[0];
}

/**
 * Step 4 placeholder verification:
 * Real verification would call hosting provider to check domain status.
 * For now, we keep it pending and let UI flow exist.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const domain = normalizeDomain(String(body?.domain || ""));
    if (!domain) return jsonError("Missing domain", 400);

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) return jsonError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY", 500);

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // placeholder: keep pending (you can change to verified for testing)
    const verified = false;
    const status = verified ? "verified" : "pending";

    const { data, error } = await supabase
      .from("custom_domains")
      .update({
        verified,
        status,
        last_error: null,
      })
      .eq("domain", domain)
      .select("id,domain,status,verified,dns_records,last_error")
      .single();

    if (error) return jsonError(error.message, 500);

    return NextResponse.json(data);
  } catch (err: any) {
    return jsonError(err?.message || "Connect crashed", 500);
  }
}



