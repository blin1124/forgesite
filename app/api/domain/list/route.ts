import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) return jsonError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY", 500);

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // If you haven’t wired auth-user filtering yet, this will list all.
    // Later you will add: .eq("user_id", auth.uid()) by switching to RLS + user client.
    const { data, error } = await supabase
      .from("custom_domains")
      .select("id,user_id,domain,status,verified,created_at,dns_records,last_error")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) return jsonError(error.message, 500);

    return NextResponse.json({ domains: data || [] });
  } catch (err: any) {
    return jsonError(err?.message || "List crashed", 500);
  }
}

