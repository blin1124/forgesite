import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 400) {
  const res = NextResponse.json({ ok: false, error: message }, { status });
  res.headers.set("cache-control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.headers.set("pragma", "no-cache");
  res.headers.set("expires", "0");
  return res;
}

function noStore(res: NextResponse) {
  res.headers.set("cache-control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.headers.set("pragma", "no-cache");
  res.headers.set("expires", "0");
  return res;
}

export async function GET(_req: Request, { params }: { params: { siteId: string } }) {
  try {
    const admin = getSupabaseAdmin();

    const siteId = String(params?.siteId || "").trim();
    if (!siteId) return jsonError("Missing siteId", 400);

    // ✅ id is unique — fetch the row directly
    const { data: row, error } = await admin
      .from("sites")
      .select("id, published_html, published_at, updated_at, created_at")
      .eq("id", siteId)
      .single();

    if (error) return jsonError(error.message, 500);
    if (!row) return jsonError("Not found", 404);

    const html = String(row.published_html || "").trim();

    const res = NextResponse.json({
      ok: true,
      id: row.id,
      published: Boolean(html),
      html: html || "",
      published_at: row.published_at || null,
      updated_at: row.updated_at || null,
      created_at: row.created_at || null,
    });

    return noStore(res);
  } catch (e: any) {
    return jsonError(e?.message || "Failed", 500);
  }
}

