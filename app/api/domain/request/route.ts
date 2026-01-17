import { NextResponse } from "next/server";
import {
  supabaseAdmin,
  getUserIdFromAuthHeader,
  normalizeDomain,
  vercelFetch,
  extractDnsRecordsFromVercelDomain,
  upsertCustomDomain,
  getProjectId,
} from "../_lib";

export const runtime = "nodejs";

type DnsRecord = {
  type: string;
  name: string;
  value: string;
  ttl?: number | null;
};

/**
 * Fallback DNS records that work at GoDaddy/Namecheap/Ionos.
 * Vercel *may* recommend different IPs/CNAME targets over time,
 * so we always try to pull records from Vercel first; this is the safe fallback.
 */
function fallbackDnsRecords(): DnsRecord[] {
  return [
    { type: "A", name: "@", value: "76.76.21.21", ttl: 600 },
    { type: "CNAME", name: "www", value: "cname.vercel-dns.com", ttl: 600 },
  ];
}

function isAlreadyInUse(addJson: any, addText?: string) {
  const code = String(addJson?.error?.code || addJson?.code || "");
  const msg = String(addJson?.error?.message || addJson?.message || addText || "");
  return (
    code.includes("domain_already_in_use") ||
    msg.toLowerCase().includes("already in use") ||
    msg.toLowerCase().includes("already added")
  );
}

/**
 * Try hard to get DNS records:
 * 1) extract from Vercel "add domain" response
 * 2) fetch the domain detail endpoint and extract again
 * 3) if still empty, return fallback A + CNAME
 */
async function getBestDnsRecords(projectId: string, domain: string, teamQS: string, addJson: any) {
  // 1) Try from add response
  let dns = extractDnsRecordsFromVercelDomain(addJson) as any;
  if (Array.isArray(dns) && dns.length) return dns as DnsRecord[];

  // 2) Try fetching detailed domain info from the project
  const info = await vercelFetch(
    `/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domain)}${teamQS}`,
    { method: "GET" }
  );

  if (info?.res?.ok) {
    dns = extractDnsRecordsFromVercelDomain(info.json) as any;
    if (Array.isArray(dns) && dns.length) return dns as DnsRecord[];
  }

  // 3) Fallback (what customers paste into registrar)
  return fallbackDnsRecords();
}

/**
 * Request a custom domain:
 * - verifies user via Authorization: Bearer <supabase access token>
 * - adds domain to Vercel project (or reuses if already added)
 * - stores row in custom_domains with dns_records, vercel_payload, last_error
 *
 * Body:
 * { domain: string, site_id?: string }
 */
export async function POST(req: Request) {
  try {
    // ✅ Must pass (admin, req)
    const user_id = await getUserIdFromAuthHeader(supabaseAdmin, req);

    const body = await req.json().catch(() => ({}));
    const domainRaw = String(body?.domain || "");
    const site_id = body?.site_id ? String(body.site_id) : null;

    const domain = normalizeDomain(domainRaw);
    if (!domain) {
      return NextResponse.json({ error: "Invalid domain" }, { status: 400 });
    }

    const projectId = getProjectId();

    const teamId = process.env.VERCEL_TEAM_ID || "";
    const teamQS = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";

    // 1) Attempt to add domain to Vercel project
    const add = await vercelFetch(`/v9/projects/${encodeURIComponent(projectId)}/domains${teamQS}`, {
      method: "POST",
      body: JSON.stringify({ name: domain }),
    });

    // If add failed because it already exists, that’s fine — treat as success-ish
    if (!add.res.ok && !isAlreadyInUse(add.json, add.text)) {
      const msg =
        add.json?.error?.message ||
        add.json?.message ||
        `Vercel add domain failed (${add.res.status})`;

      await upsertCustomDomain({
        admin: supabaseAdmin,
        user_id,
        site_id,
        domain,
        status: "error",
        last_error: msg,
        vercel_payload: add.json || add.text,
      });

      return NextResponse.json({ error: msg, details: add.json || add.text }, { status: 400 });
    }

    // 2) Determine "verified" best-effort
    const verifiedFromAdd = !!add.json?.verified;

    // 3) Get DNS records (must not be empty for customers)
    const dns_records = await getBestDnsRecords(projectId, domain, teamQS, add.json);

    // If we got here via "already in use", pull a better verified signal via status endpoint
    let verified = verifiedFromAdd;
    if (!verified) {
      const info = await vercelFetch(
        `/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domain)}${teamQS}`,
        { method: "GET" }
      );
      if (info?.res?.ok) verified = !!info.json?.verified;
    }

    // 4) Save/update DB row
    const row = await upsertCustomDomain({
      admin: supabaseAdmin,
      user_id,
      site_id,
      domain,
      status: verified ? "verified" : "pending",
      dns_records,
      vercel_verified: verified,
      vercel_payload: add.json,
      last_error: null,
    });

    // 5) Return what the frontend needs to render the DNS table
    return NextResponse.json({
      ok: true,
      domain: row?.domain || domain,
      status: row?.status || (verified ? "verified" : "pending"),
      vercel_verified: row?.vercel_verified ?? verified,
      dns_records: row?.dns_records ??











