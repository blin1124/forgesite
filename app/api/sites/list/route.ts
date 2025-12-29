import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return jsonError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY", 500);
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const { data, error } = await supabase
      .from("sites")
      .select("id, template, content, created_at, html, prompt, name")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) return jsonError(error.message, 500);

    return NextResponse.json({ sites: data || [] });
  } catch (err: any) {
    console.error("SITES_LIST_ERROR:", err);
    return jsonError(err?.message || "List route crashed", 500);
  }
}

