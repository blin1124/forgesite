import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function noStore(res: NextResponse) {
  res.headers.set("cache-control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.headers.set("pragma", "no-cache");
  res.headers.set("expires", "0");
  return res;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const id = body?.id ? String(body.id).trim() : null;
    const template = body?.template ? String(body.template) : "html";
    const prompt = body?.prompt ? String(body.prompt) : null;
    const html = String(body?.html || "");

    if (!html.trim()) return jsonError("Missing html", 400);

    // 1) Read auth token from request header
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7)
      : "";

    if (!token) return jsonError("Missing Authorization bearer token", 401);

    // 2) Service-role client (we still enforce user auth using the token)
    const supabaseUrl =
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return jsonError("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY", 500);
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

    // 4) Update existing if id provided, else insert new
    if (id) {
      // Ensure the site belongs to this user
      const { data: existing, error: exErr } = await admin
        .from("sites")
        .select("id,user_id")
        .eq("id", id)
        .maybeSingle();

      if (exErr) return jsonError(exErr.message, 500);
      if (!existing) return jsonError("Site not found", 404);
      if (String(existing.user_id) !== String(user_id)) return jsonError("Forbidden", 403);

      const { error: upErr } = await admin
        .from("sites")
        .update({
          template,
          prompt,
          html,
          updated_at: new Date().toISOString(),
          // ❌ IMPORTANT: DO NOT TOUCH published_html here
        })
        .eq("id", id);

      if (upErr) return jsonError(upErr.message, 500);

      return noStore(NextResponse.json({ ok: true, id }));
    }

    // No id -> create new site
    const { data, error } = await admin
      .from("sites")
      .insert([
        {
          user_id,
          template,
          prompt,
          html,
        },
      ])
      .select("id")
      .single();

    if (error) return jsonError(error.message, 500);

    return noStore(NextResponse.json({ ok: true, id: data.id }));
  } catch (err: any) {
    console.error("SAVE_SITE_ERROR:", err);
    return jsonError(err?.message || "Save route crashed", 500);
  }
}
