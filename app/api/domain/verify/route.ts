import {
  extractDnsRecordsFromVercelDomain,
  getProjectId,
  getCustomDomainRow,
  jsonErr,
  jsonOk,
  normalizeDomain,
  requireUserId,
  upsertCustomDomain,
  vercelFetch,
} from "../_lib";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user_id = await requireUserId();
    const body = await req.json().catch(() => ({}));
    const domain = normalizeDomain(String(body?.domain || ""));

    if (!domain) return jsonErr("Missing domain");

    const existing = await getCustomDomainRow(user_id, domain);
    const projectId = getProjectId();

    const dom = await vercelFetch(`/v10/projects/${projectId}/domains/${encodeURIComponent(domain)}`, {
      method: "GET",
    });

    const dns_records = extractDnsRecordsFromVercelDomain(dom);
    const verified = !!dom?.verified;
    const status = verified ? "verified" : "pending";

    const row = await upsertCustomDomain({
      user_id,
      site_id: existing?.site_id ?? (body?.site_id ? String(body.site_id) : null),
      domain,
      status,
      verified,
      dns_records,
      verification: dom,
    });

    return jsonOk({
      domain: row.domain,
      site_id: row.site_id,
      verified: row.verified,
      status: row.status,
      dns_records: row.dns_records || [],
      vercel: {
        verified: !!dom?.verified,
        verification: dom?.verification || null,
      },
    });
  } catch (e: any) {
    return jsonErr(e?.message || "Verify failed", 500);
  }
}



