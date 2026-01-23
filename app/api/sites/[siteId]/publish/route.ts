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
 * Publishes a site:
 * - Requires Authorization: Bearer <supabase_access_token>
 * - Verifies ownership
 * - Uses body.html (if provided) else uses DB sites.html
 * - Copies -> sites.published_html
 * - Sets sites.content = "published"
 */
export async function POST(req: Request, { params }: { params: { siteId: string } }) {
  try {
    const admin = getSupabaseAdmin();

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!token) return jsonErr("Missing Authorization Bearer token", 401);

    const { data: userRes, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userRes?.user?.id) return jsonErr("Invalid session", 401);
    const user_id = userRes.user.id;

    const siteId = String(params?.siteId || "").trim();
    if (!siteId) return jsonErr("Missing siteId", 400);

    // Read optional body (html/prompt)
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const bodyHtml = typeof body?.html === "string" ? body.html : "";
    const bodyPrompt = typeof body?.prompt === "string" ? body.prompt : "";

    // 1) Verify owner + get current draft html
    const { data: site, error: siteErr } = await admin
      .from("sites")
      .select("id, user_id, html, prompt")
      .eq("id", siteId)
      .maybeSingle();

    if (siteErr) return jsonErr(siteErr.message, 400);
    if (!site) return jsonErr("Site not found", 404);
    if (site.user_id !== user_id) return jsonErr("Not authorized for this site", 403);

    // 2) Choose publish source: body.html OR DB html
    const publishHtml = (bodyHtml || String(site.html || "")).trim();
    const nextPrompt = (bodyPrompt || String(site.prompt || "")).trim();

    if (!publishHtml) return jsonErr("No HTML to publish (body + DB empty).", 400);

    const now = new Date().toISOString();

    // 3) Update BOTH draft html (optional but keeps DB in sync) + published_html
    const { data: updated, error: upErr } = await admin
      .from("sites")
      .update({
        // keep draft in sync with what user just published
        html: publishHtml,
        prompt: nextPrompt || null,

        content: "published",
        published_html: publishHtml,
        updated_at: now,
      })
      .eq("id", siteId)
      .select("id, content, updated_at")
      .maybeSingle();

    if (upErr) return jsonErr(upErr.message, 400);

    return jsonOk({
      ok: true,
      id: updated?.id || siteId,
      status: updated?.content || "published",
      updated_at: updated?.updated_at || now,
    });
  } catch (e: any) {
    return jsonErr(e?.message || "Publish failed", 500);
  }
}









