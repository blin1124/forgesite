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
 * - (NEW) Accepts { html, prompt, template } from client and publishes THAT
 * - Writes:
 *    - sites.html (draft) = html
 *    - sites.published_html (live) = html
 *    - sites.prompt = prompt
 *    - sites.content = "published"
 *    - sites.updated_at = now()
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

    // Read optional body overrides (publish what the builder currently has)
    const body = await req.json().catch(() => ({}));
    const bodyHtml = typeof body?.html === "string" ? body.html : "";
    const bodyPrompt = typeof body?.prompt === "string" ? body.prompt : "";
    const bodyTemplate = typeof body?.template === "string" ? body.template : "html";

    // 1) Verify owner + get current db draft
    const { data: site, error: siteErr } = await admin
      .from("sites")
      .select("id, user_id, html, prompt")
      .eq("id", siteId)
      .maybeSingle();

    if (siteErr) return jsonErr(siteErr.message, 400);
    if (!site) return jsonErr("Site not found", 404);
    if (site.user_id !== user_id) return jsonErr("Not authorized for this site", 403);

    // Prefer incoming html (what’s on screen). Fall back to db draft.
    const draftHtml = (bodyHtml || String(site.html || "")).trim();
    const nextPrompt = (bodyPrompt || String(site.prompt || "")).trim();

    if (!draftHtml) return jsonErr("No HTML to publish (draft is empty)", 400);

    // 2) Publish = write BOTH draft + live in one update
    const now = new Date().toISOString();

    const { data: updated, error: upErr } = await admin
      .from("sites")
      .update({
        template: bodyTemplate || "html",
        prompt: nextPrompt,
        html: draftHtml, // keep draft in sync
        content: "published",
        published_html: draftHtml, // live
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









