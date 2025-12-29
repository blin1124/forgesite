import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { encryptText } from "@/lib/crypto";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey);
}

export async function POST(req: Request) {
  try {
    const { apiKey } = await req.json();
    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json({ error: "Missing apiKey" }, { status: 400 });
    }

    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = supabaseAdmin();

    // Validate user from access token
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = userData.user.id;
    const encrypted = encryptText(apiKey);

    // Upsert by user_id (requires unique constraint on user_id)
    const { error: dbErr } = await admin
      .from("user_api_keys")
      .upsert(
        { user_id: userId, encrypted_key: encrypted, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );

    if (dbErr) {
      return NextResponse.json({ error: dbErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}




