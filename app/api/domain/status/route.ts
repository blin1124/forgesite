import { NextResponse } from "next/server";
import {
  supabaseAdmin,
  getUserIdFromAuthHeader,
  normalizeDomain,
  vercelFetch,
  extractDnsRecordsFromVercelDomain,
  getCustomDomainRow,
  upsertCustomDomain,
  getProjectId,
} from "../_lib";

export const runtime = "nodejs";

/**
 * Checks current Vercel domain status for a domain and updates DB row.
 * Body:
 * { domain: string }
 */
export async function POST(req: Request) {
  try {
    const user_id = await getUserIdFromAuthHeader(supabaseAdmin, req);
    if (!user_id) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const rawDomain = String(body?.domain || "");
    const domain = normalizeDomain(rawDomain);
    if (!domain) return NextResponse.json({ error: "Invalid domain" }, { status: 400 });

    // ensure the domain belongs to this user in DB (basic safety)
    const existing = await getCustomDomainRow({ admin: supabaseAdmin, user_id, domain });
    if (!existing) {
      return NextResponse.json({ error: "Domain not found for this user" }, { status: 404 });
    }

    const projectId = getProjectId();
    const teamId = process.env.VERCEL_TEAM_ID || "";
    const teamQS = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";

    // Pull status from Vercel
    const st = await vercelFetch(
      `/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domain)}${teamQS}`,
      { method: "GET" }
    );

    if (!st.res.ok) {
      const msg =
        st.json?.error?.message ||
        st.json?.message ||
        st.text ||
        `Failed to fetch domain status (${st.res.status})`;

      // ✅ FIX: include admin
      await upsertCustomDomain({
        admin: supabaseAdmin,
        user_id,
        domain,
        status: "error",
        last_error: msg,
        vercel_payload: st.json || st.text,
      });

      return NextResponse.json({ error: msg, details: st.json || st.text }, { status: 400 });
    }

    const verified = !!st.json?.verified;
    const dns_records = extractDnsRecordsFromVercelDomain(st.json);

    const updated = await upsertCustomDomain({
      admin: supabaseAdmin,
      user_id,
      domain,
      status: verified ? "verified" : "pending",
      vercel_verified: verified,
      dns_records,
      vercel_payload: st.json,
      last_error: null,
    });

    return NextResponse.json({
      ok: true,
      domain: updated?.domain || domain,
      status: updated?.status || (verified ? "verified" : "pending"),
      vercel_verified: updated?.vercel_verified ?? verified,
      dns_records: updated?.dns_records ?? dns_records,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Status failed" }, { status: 500 });
  }
}




