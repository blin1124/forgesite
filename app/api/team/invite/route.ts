// app/api/team/invite/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const teamId = String(body.teamId || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const role = String(body.role || "member").trim();

    if (!teamId) return new NextResponse("Missing teamId", { status: 400 });
    if (!email) return new NextResponse("Missing email", { status: 400 });

    const { error } = await supabaseAdmin.from("team_invites").insert({
      team_id: teamId,
      email,
      role,
      status: "pending",
      created_at: new Date().toISOString(),
    });

    if (error) return new NextResponse(error.message, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return new NextResponse(err?.message || "Invite failed", { status: 500 });
  }
}



