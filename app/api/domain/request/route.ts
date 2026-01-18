import { NextResponse } from "next/server";
import { supabaseAdmin, getUserIdFromAuthHeader, normalizeDomain, upsertCustomDomain } from "../_lib";

export const runtime = "nodejs";

type DnsRecord = {
  type: string;
  name: string;
  value: string;
  ttl?: number | null;
};

function defaultDnsRecords(): DnsRecord[] {
  // Works for GoDaddy / Namecheap / IONOS as a baseline.
  // Apex/root (@) uses A record. "www" uses CNAME.
  return [
    { type: "A", name: "@", value: "76.76.21.21", ttl: 600 },
    { type: "CNAME", name: "www", value: "cname.vercel-dns.com", ttl: 600 },
  ];
}

/**
 * Request DNS instructions ONLY (does NOT attach domain to Vercel).
 *
 * Body:
 * { domain: string, site_id?: string }
 */
export async function POST(req: Request) {
  try {
    // Auth (expects Authorization: Bearer <supabase access token>)
    const user_id = await getUserIdFromAuthHeader(supabaseAdmin, req);

    // Input
    const body = await req.json().catch(() => ({}));
    const domainRaw = String(body?.domain || "");
    const site_id = body?.site_id ? String(body.site_id) : null;

    const domain = normalizeDomain(domainRaw);
    if (!domain) {
      return NextResponse.json({ error: "Invalid domain" }, { status: 400 });
    }

    // Always return copy/paste DNS instructions
    const dns_records = defaultDnsRecords();

    // Store for UI + audit trail (does NOT affect Vercel)
    const row = await upsertCustomDomain({
      admin: supabaseAdmin,
      user_id,
      site_id,
      domain,
      status: "dns_required",
      dns_records,
      vercel_verified: false,
      vercel_payload: null,
      last_error: null,
    });

    return NextResponse.json({
      ok: true,
      domain: row?.domain || domain,
      status: row?.status || "dns_required",
      vercel_verified: row?.vercel_verified ?? false,
      dns_records: row?.dns_records ?? dns_records,
      note:
        "Add these DNS records at your registrar (GoDaddy/Namecheap/IONOS). After they propagate, click Verify DNS, then Connect.",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Request failed" }, { status: 500 });
  }
}
















