import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 400) {
  const res = NextResponse.json({ ok: false, error: message }, { status });
  res.headers.set("cache-control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.headers.set("pragma", "no-cache");
  res.headers.set("expires", "0");
  return res;
}

function jsonOk(payload: any) {
  const res = NextResponse.json(payload);
  res.headers.set("cache-control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.headers.set("pragma", "no-cache");
  res.headers.set("expires", "0");
  return res;
}

export async function POST(_req: Request, { params }: { params: { siteId: string } }) {
  try {
    const siteId = String(params?.siteId || "").trim();
    if (!siteId) return jsonError("Missing siteId", 400);

    // ✅ Use SAME auth mechanism as your /api/sites/save route (cookies)
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (userErr || !user) return jsonError("Not signed in", 401);

    const admin = getSupabaseAdmin();

    // ✅ Fetch latest saved draft html for this site (must belong to user)
    const { data: site, error: siteErr } = await admin
      .from("sites")
      .select("id, user_id, html")
      .eq("id", siteId)
      .maybeSingle();

    if (siteErr) return jsonError(siteErr.message, 500);
    if (!site) return jsonError("Site not found", 404);
    if (String(site.user_id) !== String(user.id)) return jsonError("Forbidden", 403);

    const latestHtml = String(site.html || "").trim();
    if (!latestHtml) return jsonError("Nothing to publish (html is empty)", 400);

    const now = new Date().toISOString();

    // ✅ Publish draft -> published_html (and set published_at if the column exists)
    const { error: upErr } = await admin
      .from("sites")
      .update({
        published_html: latestHtml,
        published_at: now,
      })
      .eq("id", siteId);

    if (upErr) return jsonError(upErr.message, 500);

    return jsonOk({ ok: true, siteId, published: true, bytes: latestHtml.length, published_at: now });
  } catch (e: any) {
    return jsonError(e?.message || "Publish failed", 500);
  }
}











