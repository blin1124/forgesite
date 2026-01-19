import { NextResponse } from "next/server";
import { supabaseAdmin, getUserIdFromAuthHeader } from "@/app/api/_lib";

export const runtime = "nodejs";

/**
 * Publishes a site by flipping its status in public.sites.
 * - Requires Authorization: Bearer <supabase access token>
 * - Ensures the site belongs to the signed-in user
 *
 * URL:
 * POST /api/sites/:siteId/publish
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ siteId: string }> }
) {
  try {
    const user_id = await getUserIdFromAuthHeader(supabaseAdmin, req);
    if (!user_id) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { siteId } = await ctx.params;
    if (!siteId) return NextResponse.json({ error: "Missing siteId" }, { status: 400 });

    // 1) Confirm site exists + belongs to user
    const { data: site, error: selErr } = await supabaseAdmin
      .from("sites")
      .select("id,user_id,html,content")
      .eq("id", siteId)
      .maybeSingle();

    if (selErr) return NextResponse.json({ error: selErr.message }, { status: 500 });
    if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });
    if (site.user_id !== user_id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // 2) Must have HTML to publish
    const html = String(site.html || "");
    if (!html || html.length < 20) {
      return NextResponse.json(
        { error: "Nothing to publish yet (site.html is empty)" },
        { status: 400 }
      );
    }

    // 3) Publish: set content status to 'published'
    // (This matches your current schema without adding columns.)
    const { data: updated, error: upErr } = await supabaseAdmin
      .from("sites")
      .update({ content: "published" })
      .eq("id", siteId)
      .eq("user_id", user_id)
      .select("id,content")
      .maybeSingle();

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      site_id: updated?.id || siteId,
      status: updated?.content || "published",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Publish failed" }, { status: 500 });
  }
}
