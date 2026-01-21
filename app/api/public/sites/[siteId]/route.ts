import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function jsonErr(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function jsonOk(payload: any = {}) {
  return NextResponse.json(payload);
}

/**
 * Public endpoint:
 * Returns ONLY published HTML for a site.
 * No auth required.
 */
export async function GET(
  _req: Request,
  { params }: { params: { siteId: string } }
) {
  try {
    const admin = getSupabaseAdmin();

    const siteId = String(params?.siteId || "").trim();
    if (!siteId) return jsonErr("Missing siteId", 400);

    const { data: site, error } = await admin
      .from("sites")
      .select("id, content, published_html")
      .eq("id", siteId)
      .maybeSingle();

    if (error) return jsonErr(error.message, 400);
    if (!site) return jsonErr("Site not found", 404);

    const isPublished = String(site.content || "").toLowerCase() === "published";
    const html = String(site.published_html || "");

    if (!isPublished || !html.trim()) {
      // Return ok but no html, so the page can show "not published yet"
      return jsonOk({ ok: true, published: false, html: "" });
    }

    return jsonOk({ ok: true, published: true, html });
  } catch (e: any) {
    return jsonErr(e?.message || "Failed", 500);
  }
}
