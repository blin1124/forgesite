import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonErr(message: string, status: number = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function noStore(res: NextResponse) {
  res.headers.set("cache-control", "no-store, no-cache, must-revalidate");
  res.headers.set("pragma", "no-cache");
  res.headers.set("expires", "0");
  return res;
}

export async function POST(req: Request, ctx: { params: { siteId: string } }) {
  try {
    const siteId = String(ctx?.params?.siteId || "").trim();
    if (!siteId) {
      return jsonErr("Missing siteId", 400);
    }

    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) {
      return jsonErr("Missing auth token", 401);
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) {
      return jsonErr("Missing Supabase env vars", 500);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });

    const userResp = await userClient.auth.getUser();
    const user = userResp?.data?.user || null;
    if (!user) {
      return jsonErr("Unauthorized", 401);
    }

    const admin = getSupabaseAdmin();

    // ✅ ALWAYS FETCH MOST RECENT DRAFT
    const draftResp = await admin
      .from("sites")
      .select("id, user_id, html, updated_at")
      .eq("id", siteId)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (draftResp.error) {
      return jsonErr(draftResp.error.message, 500);
    }

    const site = (draftResp.data && draftResp.data[0]) ? draftResp.data[0] : null;
    if (!site) {
      return jsonErr("Site not found", 404);
    }

    if (String(site.user_id) !== String(user.id)) {
      return jsonErr("Forbidden", 403);
    }

    const html = String(site.html || "").trim();
    if (!html) {
      return jsonErr("Draft HTML is empty", 400);
    }

    const now = new Date().toISOString();

    const upResp = await admin
      .from("sites")
      .update({
        published_html: html,
        published_at: now,
        content: "published",
      })
      .eq("id", siteId);

    if (upResp.error) {
      return jsonErr(upResp.error.message, 500);
    }

    return noStore(
      NextResponse.json({
        ok: true,
        siteId,
        published: true,
        bytes: html.length,
        published_at: now,
      })
    );
  } catch (e: any) {
    return jsonErr(e?.message || "Publish failed", 500);
  }
}













