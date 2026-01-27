import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
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

    // ✅ Always pick the newest record by updated_at (never maybeSingle)
    const { data, error } = await admin
      .from("sites")
      .select("id, published_html, updated_at")
      .eq("id", siteId)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (error) return jsonError(error.message, 500);

    const row = data?.[0];
    if (!row) return jsonError("Not found", 404);

    const html = String(row.published_html || "").trim();

    const res = NextResponse.json({
      ok: true,
      id: row.id,
      published: Boolean(html),
      html: html || "",
      updated_at: row.updated_at || null,
    });

    return noStore(res);
  } catch (e: any) {
    return jsonError(e?.message || "Failed", 500);
  }
}

