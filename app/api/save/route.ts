import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return jsonError("Invalid JSON body", 400);

    const session_id = String(body.session_id || "").trim();
    const name = String(body.name || "Untitled Site").trim();
    const prompt = String(body.prompt || "").trim();
    const html = String(body.html || "").trim();

    if (!session_id) return jsonError("Missing session_id", 400);
    if (!prompt) return jsonError("Missing prompt", 400);
    if (!html) return jsonError("Missing html", 400);

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return jsonError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY", 500);
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // ✅ This matches the schema you actually have:
    // requires BOTH session_id and template (NOT NULL)
    const { data, error } = await supabase
      .from("sites")
      .insert([
        {
          session_id,
          name,               // ok if column exists
          template: "html",   // REQUIRED (your error shows NOT NULL)
          content: "generated",
          prompt,
          html,
        },
      ])
      .select("id, created_at")
      .single();

    if (error) return jsonError(`Save failed: ${error.message}`, 500);

    return NextResponse.json({ ok: true, saved: data });
  } catch (err: any) {
    console.error("SAVE_ROUTE_ERROR:", err);
    return jsonError(err?.message || "Save route crashed", 500);
  }
}

