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

function normalizeDomain(input: string) {
  return input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
}

export async function POST(req: Request) {
  try {
    const admin = getAdmin();
    const user_id = await getUserIdFromAuthHeader(admin, req);

    const body = await req.json().catch(() => ({}));
    const domainRaw = String(body?.domain || "");
    const domain = normalizeDomain(domainRaw);

    if (!domain || !domain.includes(".")) return jsonError("Enter a valid domain (example.com)", 400);

    // Placeholder DNS records until Step 6 (Vercel provisioning) is enabled.
    const dns_records = [
      { type: "CNAME", name: "www", value: "cname.vercel-dns.com", note: "recommended" },
      { type: "A", name: "@", value: "76.76.21.21", note: "apex/root" },
    ];

    // Upsert by (user_id, domain)
    const { data, error } = await admin
      .from("custom_domains")
      .upsert(
        {
          user_id,
          domain,
          status: "pending",
          verified: false,
          dns_records,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,domain" }
      )
      .select("id, domain, status, verified, dns_records, created_at, updated_at")
      .single();

    if (error) return jsonError(error.message, 500);

    return NextResponse.json({
      domain: data,
      dns_records,
      message: "DNS records generated. Add them in your registrar (GoDaddy/IONOS/Namecheap), then click Verify now.",
    });
  } catch (err: any) {
    return jsonError(err?.message || "Request failed", 500);
  }
}





