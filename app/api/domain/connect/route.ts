import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

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

/**
 * IMPORTANT:
 * Do NOT type `admin` as a strict SupabaseClient generic here.
 * Different projects have different SupabaseClient generic params
 * (and that’s what caused your build error).
 *
 * Using `any` here fixes compilation without changing runtime behavior.
 */
async function getUserIdFromAuthHeader(admin: any, req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!token) throw new Error("Missing Authorization Bearer token.");

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user?.id) throw new Error("Invalid/expired session token.");
  return data.user.id as string;
}

function normalizeDomain(input: string) {
  return input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
}

export async function POST(req: Request) {
  try {
    const admin = getAdmin();
    const user_id = await getUserIdFromAuthHeader(admin, req);

    const body = await req.json().catch(() => ({}));
    const domain = normalizeDomain(String(body?.domain || ""));
    if (!domain) return jsonError("Missing domain", 400);

    // Keep behavior: save a record (no Vercel provisioning yet here)
    const verification = {
      requested_at: new Date().toISOString(),
      provider: "vercel",
      note: "Provisioning not yet enabled. This is the customer flow + DB wiring.",
    };

    const { data, error } = await admin
      .from("custom_domains")
      .upsert(
        {
          user_id,
          domain,
          status: "pending",
          verification,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,domain" }
      )
      .select("id, domain, status, verified, dns_records, verification, created_at, updated_at")
      .single();

    if (error) return jsonError(error.message, 500);

    return NextResponse.json({
      domain: data,
      message: "Saved. Next: wiring Vercel provisioning to return real DNS verification challenges.",
    });
  } catch (err: any) {
    return jsonError(err?.message || "Connect failed", 500);
  }
}







