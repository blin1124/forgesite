import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export async function GET(_: Request, { params }: { params: { siteId: string } }) {
  try {
    const siteId = String(params?.siteId || "").trim();
    if (!siteId) return NextResponse.json({ error: "Missing siteId" }, { status: 400 });

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("sites")
      .select("published_html, updated_at")
      .eq("id", siteId)
      .maybeSingle();

    if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const html = String(data.published_html || "").trim();
    if (!html) return NextResponse.json({ html: "" }, { status: 200, headers: { "cache-control": "no-store" } });

    return NextResponse.json(
      { html, updated_at: data.updated_at },
      { status: 200, headers: { "cache-control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}



