import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonErr(message: string, status = 400) {
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

export async function POST(req: Request, { params }: { params: { siteId: string } }) {
  try {
    const siteId = String(params?.siteId || "").trim();
    if (!siteId) return jsonErr("Missing siteId", 400);

    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return jsonErr("Missing auth token", 401);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    if (!supabaseUrl || !anonKey) return jsonErr("Server misconfigured (missing Supabase env)", 500);

    // Validate user from access token (browser session)
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });

    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) return jsonErr("Unauthorized", 401);

    const userId = userRes.user.id;
    const admin = getSupabaseAdmin();

    // Fetch the site's latest draft HTML (single row by id)
    const { data: site, error: siteErr } = await admin
      .from("sites")
      .select("id, user_id, html")
      .eq("id", siteId)
      .single();

    if (siteErr) return jsonErr(siteErr.message, 500);
    if (!site) return jsonErr("Site not found", 404);
    if (String(site.user_id) !== String(userId)) return jsonErr("Forbidden", 403);

    const latestHtml = String(site.html || "").trim();
    if (!latestHtml) return jsonErr("Site html is empty", 400);

    // ✅ Publish draft -> published_html
    // ✅ ALSO bump updated_at so lists and any "latest" logic reflects publish immediately
    const now = new Date().toISOString();

    const { error: upErr } = await admin
      .from("sites")
      .update({
        published_html: latestHtml,
        published_at: now,
        updated_at: now, // ✅ IMPORTANT
      })
      .eq("id", siteId);

    if (upErr) return jsonErr(upErr.message, 500);

    return noStore(
      NextResponse.json({
        ok: true,
        siteId,
        published: true,
        bytes: latestHtml.length,
        published_at: now,
        updated_at: now,
      })
    );
  } catch (e: any) {
    return jsonErr(e?.message || "Publish failed", 500);
  }
}












