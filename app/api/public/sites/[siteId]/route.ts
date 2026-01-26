import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(_req: Request, { params }: { params: { siteId: string } }) {
  try {
    const admin = getSupabaseAdmin();

    const siteId = String(params?.siteId || "").trim();
    if (!siteId) return jsonError("Missing siteId", 400);

    const { data, error } = await admin
      .from("sites")
      .select("id, published_html, updated_at")
      .eq("id", siteId)
      .maybeSingle();

    if (error) return jsonError(error.message, 500);
    if (!data) return jsonError("Not found", 404);

    const html = String(data.published_html || "").trim();

    const res = NextResponse.json({
      ok: true,
      id: data.id,
      published: Boolean(html),
      html: html || "",
      updated_at: data.updated_at || null,
    });

    // 🔥 Do not allow CDN / browser caching
    res.headers.set("cache-control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.headers.set("pragma", "no-cache");
    res.headers.set("expires", "0");

    return res;
  } catch (e: any) {
    return jsonError(e?.message || "Failed", 500);
  }
}
