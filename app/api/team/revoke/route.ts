// app/api/team/revoke/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const inviteId = String(body.inviteId || "").trim();

    if (!inviteId) return new NextResponse("Missing inviteId", { status: 400 });

    const { error } = await supabaseAdmin
      .from("team_invites")
      .delete()
      .eq("id", inviteId);

    if (error) return new NextResponse(error.message, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return new NextResponse(err?.message || "Revoke failed", { status: 500 });
  }
}


