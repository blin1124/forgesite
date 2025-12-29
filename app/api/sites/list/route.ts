import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
}

// GET /api/sites?sessionId=...
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const sessionId = (url.searchParams.get("sessionId") || "").trim();

    if (!sessionId) return jsonError("Missing sessionId", 400);

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("sites")
      .select("id,name,prompt,created_at,updated_at")
      .eq("session_id", sessionId)
      .order("updated_at", { ascending: false });

    if (error) return jsonError(error.message, 500);

    return NextResponse.json({ sites: data || [] });
  } catch (err: any) {
    return jsonError(err?.message || "Server error in GET /api/sites", 500);
  }
}

// POST /api/sites  body: { sessionId, name?, prompt, html, id? }
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const sessionId = String(body?.sessionId || "").trim();
    const name = String(body?.name || "").trim();
    const prompt = String(body?.prompt || "").trim();
    const html = String(body?.html || "").trim();
    const id = body?.id ? String(body.id).trim() : null;

    if (!sessionId) return jsonError("Missing sessionId", 400);
    if (!prompt) return jsonError("Missing prompt", 400);
    if (!html) return jsonError("Missing html", 400);

    const supabase = getSupabaseAdmin();

    // Upsert by id if provided, otherwise insert new
    if (id) {
      const { data, error } = await supabase
        .from("sites")
        .update({
          name: name || null,
          prompt,
          html,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("session_id", sessionId)
        .select("id")
        .single();

      if (error) return jsonError(error.message, 500);
      return NextResponse.json({ id: data.id, updated: true });
    } else {
      const { data, error } = await supabase
        .from("sites")
        .insert({
          session_id: sessionId,
          name: name || "Untitled",
          prompt,
          html,
        })
        .select("id")
        .single();

      if (error) return jsonError(error.message, 500);
      return NextResponse.json({ id: data.id, created: true });
    }
  } catch (err: any) {
    return jsonError(err?.message || "Server error in POST /api/sites", 500);
  }
}

