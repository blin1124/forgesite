import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const html = String(body?.html || "");
    const title = body?.title ? String(body.title) : null;

    if (!html.trim()) return jsonError("Missing html", 400);

    // 1) Read auth token from request header
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7)
      : "";

    if (!token) return jsonError("Missing Authorization bearer token", 401);

    // 2) Server-side Supabase client (service role key, but we still enforce user auth)
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return jsonError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY", 500);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // 3) Resolve the user from the token
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return jsonError("Unauthorized (invalid session token)", 401);
    }

    const user_id = userData.user.id;

    // 4) Insert site
    const { data, error } = await admin
      .from("sites")
      .insert([{ user_id, title, html }])
      .select("id")
      .single();

    if (error) return jsonError(error.message, 500);

    return NextResponse.json({ id: data.id });
  } catch (err: any) {
    console.error("SAVE_SITE_ERROR:", err);
    return jsonError(err?.message || "Save route crashed", 500);
  }
}
