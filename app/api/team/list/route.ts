// app/api/team/list/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const teamId = (url.searchParams.get("teamId") || "").trim();

    if (!teamId) return new NextResponse("Missing teamId", { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("team_invites")
      .select("*")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false });

    if (error) return new NextResponse(error.message, { status: 500 });

    return NextResponse.json({ ok: true, invites: data || [] });
  } catch (err: any) {
    return new NextResponse(err?.message || "List failed", { status: 500 });
  }
}

