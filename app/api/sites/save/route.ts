import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "nodejs";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const id = body?.id ? String(body.id) : null;
    const template = body?.template ? String(body.template) : "html";
    const prompt = body?.prompt ? String(body.prompt) : "";
    const html = body?.html ? String(body.html) : "";

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

    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return jsonError("Not signed in", 401);

    if (!prompt.trim()) return jsonError("Prompt is empty", 400);
    if (!html.trim()) return jsonError("HTML is empty. Generate first.", 400);

    const now = new Date().toISOString();

    if (id) {
      const { data, error } = await supabase
        .from("sites")
        .update({
          template,
          prompt,
          html,
          content: "generated", // draft state
          updated_at: now,
        })
        .eq("id", id)
        .eq("user_id", user.id)
        .select("id")
        .single();

      if (error) return jsonError(error.message, 500);
      return NextResponse.json({ ok: true, id: data.id });
    }

    const { data, error } = await supabase
      .from("sites")
      .insert({
        user_id: user.id,
        template,
        prompt,
        html,
        content: "generated",
        updated_at: now,
      })
      .select("id")
      .single();

    if (error) return jsonError(error.message, 500);

    return NextResponse.json({ ok: true, id: data.id });
  } catch (err: any) {
    console.error("SAVE_ROUTE_ERROR:", err);
    return jsonError(err?.message || "Save failed", 500);
  }
}
