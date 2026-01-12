import {
  extractDnsRecordsFromVercelDomain,
  getProjectId,
  jsonErr,
  jsonOk,
  normalizeDomain,
  requireUserId,
  upsertCustomDomain,
  vercelFetch,
} from "../_lib";

export const runtime = "nodejs";

/**
 * POST { domain }
 * Header: Authorization: Bearer <supabase access token>
 *
 * Calls Vercel domain status and updates your DB row accordingly.
 */
export async function POST(req: Request) {
  try {
    const user_id = await requireUserId(req);

    const body = await req.json().catch(() => ({}));
    const domain = normalizeDomain(String(body?.domain || ""));
    if (!domain) return jsonErr("Invalid domain", 400);

    const projectId = getProjectId();

    const st = await vercelFetch(`/v9/projects/${projectId}/domains/${encodeURIComponent(domain)}`, {
      method: "GET",
    });

    if (!st.res.ok) {
      const msg = st.json?.error?.message || st.json?.message || st.text || "Verify failed";
      await upsertCustomDomain({
        user_id,
        domain,
        status: "error",
        last_error: msg,
        vercel_payload: st.json || null,
      });
      return jsonErr(msg, 500);
    }

    const verified = !!st.json?.verified;
    const dns_records = extractDnsRecordsFromVercelDomain(st.json);

    const nextStatus = verified ? "verified" : "needs_dns";

    const row = await upsertCustomDomain({
      user_id,
      domain,
      status: nextStatus,
      vercel_verified: verified,
      dns_records,
      vercel_payload: st.json || null,
      last_error: null,
    });

    return jsonOk({
      domain,
      verified,
      status: nextStatus,
      dns_records,
      row,
      vercel: st.json,
    });
  } catch (e: any) {
    return jsonErr(e?.message || "Verify failed", 500);
  }
}





