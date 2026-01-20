import { NextResponse } from "next/server";
import { supabaseAdmin, getUserIdFromAuthHeader, jsonOk, jsonErr } from "@/app/api/domain/lib.ts";

export const runtime = "nodejs";

/**
 * Publishes a site:
 * - verifies ownership
 * - copies sites.html -> sites.published_html
 * - sets content='published'
 *
 * Requires: Authorization: Bearer <access_token>
 */
export async function POST(req: Request, { params }: { params: { siteId: string } }) {
  try {
    const user_id = await getUserIdFromAuthHeader(supabaseAdmin, req);

    const siteId = String(params?.siteId || "").trim();
    if (!siteId) return jsonErr("Missing siteId", 400);

    // 1) Ensure the site belongs to user + get draft html
    const { data: site, error: siteErr } = await supabaseAdmin
      .from("sites")
      .select("id, user_id, html")
      .eq("id", siteId)
      .maybeSingle();

    if (siteErr) return jsonErr(siteErr.message, 400);
    if (!site) return jsonErr("Site not found", 404);
    if (site.user_id !== user_id) return jsonErr("Not authorized for this site", 403);

    const draftHtml = String(site.html || "").trim();
    if (!draftHtml) return jsonErr("Draft HTML is empty. Generate/Save first.", 400);

    // 2) Copy draft -> published_html and mark published
    const { data: updated, error: upErr } = await supabaseAdmin
      .from("sites")
      .update({
        content: "published",
        published_html: draftHtml,
        updated_at: new Date().toISOString(),
      })
      .eq("id", siteId)
      .select("id, content")
      .maybeSingle();

    if (upErr) return jsonErr(upErr.message, 400);

    return jsonOk({
      ok: true,
      id: updated?.id || siteId,
      status: updated?.content || "published",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Publish failed" }, { status: 500 });
  }
}







