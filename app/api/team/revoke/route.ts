import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const teamId = String(body.teamId || "").trim();
    const email = String(body.email || "").trim().toLowerCase();

    if (!teamId) return new NextResponse("Missing teamId", { status: 400 });
    if (!email) return new NextResponse("Missing email", { status: 400 });

    const supa = supabaseAdmin;

    const { error } = await supa
      .from("team_invites")
      .delete()
      .eq("team_id", teamId)
      .eq("email", email);

    if (error) return new NextResponse(error.message, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return new NextResponse(err?.message || "Revoke failed", { status: 500 });
  }
}



