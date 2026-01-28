import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonErr(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function noStore(res: NextResponse) {
  res.headers.set("cache-control", "no-store, no-cache, must-revalidate");
  res.headers.set("pragma", "no-cache");
  res.headers.set("expires", "0");
  return res;
}

export async function POST(
  req: Request,
  { params }: { params: { siteId: string } }
) {
  try {
    const siteId = String(params.siteId || "").trim();
    if (!siteId) return jsonErr("Missing siteId");

    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return jsonErr("Missing auth token", 401);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${token}` },
        },
        auth: { persistSession: false },
      }
    );

    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return jsonErr("Unauthorized", 401);













