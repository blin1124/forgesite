import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "nodejs";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {
            // no-op for GET
          },
        },
      }
    );

    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;

    if (!user) return jsonError("Not signed in", 401);

    const { data, error } = await supabase
      .from("sites")
      .select("id, template, prompt, html, content, created_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) return jsonError(error.message, 500);

    return NextResponse.json({ sites: data || [] });
  } catch (err: any) {
    return jsonError(err?.message || "List failed", 500);
  }
}

