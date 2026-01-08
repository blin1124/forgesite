import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const domain = String(searchParams.get("domain") || "").trim().toLowerCase();
    if (!domain) return jsonError("Missing domain query param", 400);

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) return jsonError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY", 500);

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { data, error } = await supabase
      .from("custom_domains")
      .select("id,domain,status,verified,dns_records,last_error,created_at")
      .eq("domain", domain)
      .maybeSingle();

    if (error) return jsonError(error.message, 500);

    return NextResponse.json({ domain: data || null });
  } catch (err: any) {
    return jsonError(err?.message || "Status crashed", 500);
  }
}


