import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function noStore(res: NextResponse) {
  res.headers.set("cache-control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.headers.set("pragma", "no-cache");
  res.headers.set("expires", "0");
  return res;
}

export async function GET(_req: Request, { params }: { params: { siteId: string } }) {
  try {
    const siteId = String(params?.siteId || "").trim();
    if (!siteId) return jsonError("Missing siteId", 400);

    const admin = getSupabaseAdmin();

    // IMPORTANT: read PUBLISHED HTML (not draft html)
    const { data, error } = await admin
      .from("sites")
      .select("id, published_html, published_at, updated_at, created_at")
      .eq("id", siteId)
      .limit(1)
      .maybeSingle();

    if (error) return jsonError(error.message, 500);
    if (!data) return jsonError("Not found", 404);

    const publishedHtml = String(data.published_html || "").trim();

    const res = NextResponse.json({
      ok: true,
      id: data.id,
      published: Boolean(publishedHtml),
      html: publishedHtml, // <-- what /s/<id> expects
      published_at: data.published_at ?? null,
      updated_at: data.updated_at ?? null,
      created_at: data.created_at ?? null,
    });

    return noStore(res);
  } catch (e: any) {
    return jsonError(e?.message || "Failed", 500);
  }
}

