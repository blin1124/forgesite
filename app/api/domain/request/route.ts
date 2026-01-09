import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

/**
 * This route:
 * - Reads the logged-in user from Authorization: Bearer <access_token>
 * - Accepts { domain }
 * - Creates/updates a row in custom_domains for that user
 * - Returns the saved row
 *
 * NOTE: We intentionally use `admin: any` in getUserIdFromAuthHeader
 * to avoid Supabase generic typing compile errors in Next build.
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

  // remove protocol
  d = d.replace(/^https?:\/\//, "");

  // remove path/query/hash if pasted
  d = d.split("/")[0] || "";

  // remove leading www.
  d = d.replace(/^www\./, "");

  // basic safety
  d = d.replace(/\s+/g, "");
  return d;
}

export async function POST(req: Request) {
  try {
    const admin = getAdmin();
    const user_id = await getUserIdFromAuthHeader(admin, req);

    const body = await req.json().catch(() => ({}));
    const domainRaw = String(body?.domain || "");
    const domain = normalizeDomain(domainRaw);

    if (!domain || !domain.includes(".")) {
      return jsonError("Invalid domain. Example: yourbusiness.com", 400);
    }

    // Upsert per-user per-domain (assumes you have a unique constraint on (user_id, domain))
    const now = new Date().toISOString();

    const { data, error } = await admin
      .from("custom_domains")
      .upsert(
        [
          {
            user_id,
            domain,
            status: "pending",
            verified: false,
            updated_at: now,
          },
        ],
        { onConflict: "user_id,domain" }
      )
      .select("id, user_id, domain, status, verified, dns_records, verification, created_at, updated_at")
      .single();

    if (error) return jsonError(error.message, 500);

    return NextResponse.json({ domain: data });
  } catch (err: any) {
    return jsonError(err?.message || "Request failed", 500);
  }
}






