import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function jsonErr(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
function jsonOk(payload: any = {}) {
  return NextResponse.json(payload);
}

export async function POST(req: Request, { params }: { params: { siteId: string } }) {
  try {
    const admin = getSupabaseAdmin();

    // ✅ Require auth token (customer must be logged in)
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!token) return jsonErr("Missing Authorization Bearer token", 401);

    const { data: userRes, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userRes?.user?.id) return jsonErr("Invalid session", 401);
    const user_id = userRes.user.id;

    const siteId = String(params?.siteId || "").trim();
    if (!siteId) return jsonErr("Missing siteId", 400);

    // 1) Verify owner + get draft html
    const { data: site, error: siteErr } = await admin
      .from("sites")
      .select("id, user_id, html")
      .eq("id", siteId)
      .maybeSingle();

    if (siteErr) return jsonErr(siteErr.message, 400);
    if (!site) return jsonErr("Site not found", 404);
    if (site.user_id !== user_id) return jsonErr("Not authorized for this site", 403);

    const draftHtml = String(site.html || "");
    if (!draftHtml.trim()) return jsonErr("Site has no draft HTML to publish", 400);

    // 2) Publish = copy html -> published_html
    const { data: updated, error: upErr } = await admin
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

    return jsonOk({ ok: true, id: updated?.id || siteId, status: updated?.content || "published" });
  } catch (e: any) {
    return jsonErr(e?.message || "Publish failed", 500);
  }
}







