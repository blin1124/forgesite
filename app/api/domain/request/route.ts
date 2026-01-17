 import { NextResponse } from "next/server";
import {
  supabaseAdmin,
  getUserIdFromAuthHeader,
  normalizeDomain,
  upsertCustomDomain,
} from "../_lib";

export const runtime = "nodejs";

type DnsRecord = {
  type: string;
  name: string;
  value: string;
  ttl?: number | null;
};

function defaultDnsRecords(): DnsRecord[] {
  // Safe defaults that work for GoDaddy / Namecheap / IONOS
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
    const user_id = await getUserIdFromAuthHeader(supabaseAdmin, req);

    const body = await req.json().catch(() => ({}));
    const domainRaw = String(body?.domain || "");
    const site_id = body?.site_id ? String(body.site_id) : null;

    const domain = normalizeDomain(domainRaw);
    if (!domain) {
      return NextResponse.json({ error: "Invalid domain" }, { status: 400 });
    }

    const dns_records = defaultDnsRecords();

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
      note: "These are the DNS records customers should add at their registrar. Click Verify/Connect after DNS is updated.",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Request failed" }, { status: 500 });
  }
}













