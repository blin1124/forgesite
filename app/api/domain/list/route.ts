import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function jsonError(message: string, status = 500, extra?: any) {
  return NextResponse.json({ error: message, ...(extra ? { extra } : {}) }, { status });
}

function getAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("Missing env: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)");
  if (!service) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, service, { auth: { persistSession: false } });
}

async function getUserIdFromAuthHeader(admin: ReturnType<typeof createClient>, req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!token) throw new Error("Missing Authorization Bearer token.");

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user?.id) throw new Error("Invalid/expired session token.");
  return data.user.id;
}

export async function GET(req: Request) {
  try {
    const admin = getAdmin();
    const user_id = await getUserIdFromAuthHeader(admin, req);

    const { data, error } = await admin
      .from("custom_domains")
      .select("id, domain, status, verified, dns_records, verification, created_at, updated_at")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false });

    if (error) return jsonError(error.message, 500);

    return NextResponse.json({ domains: data || [] });
  } catch (err: any) {
    return jsonError(err?.message || "List failed", 500);
  }
}

