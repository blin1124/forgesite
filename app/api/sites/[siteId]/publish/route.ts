import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const id = body?.id ? String(body.id) : null;
    if (!id) return jsonError("Missing site id", 400);

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

    // 1) Load the latest draft html
    const { data: site, error: readErr } = await supabase
      .from("sites")
      .select("id, html")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (readErr) return jsonError(readErr.message, 500);

    const draftHtml = String(site?.html || "").trim();
    if (!draftHtml) return jsonError("Nothing to publish (html is empty)", 400);

    const now = new Date().toISOString();

    // 2) Copy draft -> published
    const { error: writeErr } = await supabase
      .from("sites")
      .update({
        published_html: draftHtml,
        published_at: now,
        content: "published",
        updated_at: now,
      })
      .eq("id", id)
      .eq("user_id", user.id);

    if (writeErr) return jsonError(writeErr.message, 500);

    return NextResponse.json({ ok: true, id, published_at: now });
  } catch (err: any) {
    console.error("PUBLISH_ROUTE_ERROR:", err);
    return jsonError(err?.message || "Publish failed", 500);
  }
}











