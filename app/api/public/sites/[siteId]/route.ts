import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStore(res: NextResponse) {
  res.headers.set("cache-control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.headers.set("pragma", "no-cache");
  res.headers.set("expires", "0");
  return res;
}

export async function GET(_: Request, { params }: { params: { siteId: string } }) {
  const siteId = String(params?.siteId || "").trim();
  if (!siteId) {
    return noStore(NextResponse.json({ ok: false, error: "Missing siteId" }, { status: 400 }));
  }

  const admin = getSupabaseAdmin();

  // ✅ IMPORTANT: read published_html (not html)
  const { data, error } = await admin
    .from("sites")
    .select("published_html, published_at")
    .eq("id", siteId)
    .maybeSingle();

  if (error) {
    return noStore(NextResponse.json({ ok: false, error: error.message }, { status: 500 }));
  }

  const html = String(data?.published_html || "").trim();
  if (!html) {
    return noStore(NextResponse.json({ ok: true, html: "" }, { status: 200 }));
  }

  return noStore(
    NextResponse.json({
      ok: true,
      html,
      published_at: data?.published_at || null,
    })
  );
}

