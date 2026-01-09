import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

/**
 * Domain status route:
 * - Auth: Authorization: Bearer <supabase_access_token>
 * - Input: { domain }
 * - Output: { domain: row }
 *
 * IMPORTANT: `admin` is typed as `any` inside getUserIdFromAuthHeader
 * to avoid Supabase generic typing build errors in Next.js.
 */

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function getAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("Missing env: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)");
  if (!service) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, service, { auth: { persistSession: false } });
}

async function getUserIdFromAuthHeader(admin: any, req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!token) throw new Error("Missing Authorization Bearer token.");

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user?.id) throw new Error("Invalid/expired session token.");
  return data.user.id as string;
}

function normalizeDomain(raw: string) {
  let d = (raw || "").trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "");
  d = d.split("/")[0] || "";
  d = d.replace(/^www\./, "");
  d = d.replace(/\s+/g, "");
  return d;
}

export async function POST(req: Request) {
  try {
    const admin = getAdmin();
    const user_id = await getUserIdFromAuthHeader(admin, req);

    const body = await req.json().catch(() => ({}));
    const domain = normalizeDomain(String(body?.domain || ""));

    if (!domain || !domain.includes(".")) {
      return jsonError("Invalid domain. Example: yourbusiness.com", 400);
    }

    const { data, error } = await admin
      .from("custom_domains")
      .select("id, user_id, domain, status, verified, dns_records, verification, created_at, updated_at")
      .eq("user_id", user_id)
      .eq("domain", domain)
      .maybeSingle();

    if (error) return jsonError(error.message, 500);

    // Return null if not found (client can treat as "not requested yet")
    return NextResponse.json({ domain: data || null });
  } catch (err: any) {
    return jsonError(err?.message || "Status failed", 500);
  }
}





