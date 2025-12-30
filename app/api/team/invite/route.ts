import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const owner_email = String(body.owner_email || "").trim().toLowerCase();

    if (!owner_email) {
      return new NextResponse("Missing owner_email", { status: 400 });
    }

    // supabaseAdmin is an object (do NOT call it)
    const supa = supabaseAdmin;

    const { data: owner, error: e1 } = await supa
      .from("entitlements")
      .select("team_id, role")
      .eq("email", owner_email)
      .maybeSingle();

    if (e1 || !owner || owner.role !== "owner") {
      return new NextResponse("Not owner or no team", { status: 403 });
    }

    const { data: members, error: e2 } = await supa
      .from("entitlements")
      .select("email, role")
      .eq("team_id", owner.team_id);

    if (e2) return new NextResponse(e2.message, { status: 500 });

    return NextResponse.json({
      ok: true,
      team_id: owner.team_id,
      members: members || [],
    });
  } catch (err: any) {
    return new NextResponse(err?.message || "List failed", { status: 500 });
  }
}




