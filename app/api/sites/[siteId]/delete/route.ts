import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonErr(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(_req: Request, { params }: { params: { siteId: string } }) {
  try {
    const siteId = String(params?.siteId || "").trim();
    if (!siteId) return jsonErr("Missing siteId", 400);

    const auth = _req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return jsonErr("Missing auth token", 401);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) return jsonErr("Server missing Supabase env vars", 500);

    // Verify caller (user-scoped)
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });

    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) return jsonErr("Unauthorized", 401);

    const userId = userRes.user.id;
    const admin = getSupabaseAdmin();

    // Confirm ownership
    const { data: site, error: siteErr } = await admin
      .from("sites")
      .select("id,user_id")
      .eq("id", siteId)
      .maybeSingle();

    if (siteErr) return jsonErr(siteErr.message, 500);
    if (!site) return jsonErr("Site not found", 404);
    if (String(site.user_id) !== String(userId)) return jsonErr("Forbidden", 403);

    // Delete related custom domains first (optional but prevents leftovers)
    await admin.from("custom_domains").delete().eq("site_id", siteId);

    // Delete the site
    const { error: delErr } = await admin.from("sites").delete().eq("id", siteId);
    if (delErr) return jsonErr(delErr.message, 500);

    return NextResponse.json({ ok: true, siteId });
  } catch (e: any) {
    return jsonErr(e?.message || "Delete failed", 500);
  }
}
