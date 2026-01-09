// app/api/domain/list/route.ts
import { NextResponse } from "next/server";
import { getUserFromCookie, supabaseAdmin } from "../_lib";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getUserFromCookie();
    if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const db = supabaseAdmin();
    const { data, error } = await db
      .from("custom_domains")
      .select("id, domain, status, verification, last_error, created_at, updated_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return NextResponse.json({ domains: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "List failed" }, { status: 500 });
  }
}


