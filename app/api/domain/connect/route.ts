import { NextResponse } from "next/server";
import {
  supabaseAdmin,
  getUserIdFromRequest,
  normalizeDomain,
  vercelFetch,
  extractDnsRecordsFromVercelDomain,
  upsertCustomDomain,
  getProjectId,
} from "../_lib";

export const runtime = "nodejs";

function looksAlreadyInUse(payload: any, textFallback?: string) {
  const code = String(payload?.error?.code || payload?.code || payload?.details?.error?.code || "");
  const msg = String(payload?.error?.message || payload?.message || payload?.error || "");
  const raw = String(textFallback || "");
  const hay = `${code} ${msg} ${raw}`.toLowerCase();
  return hay.includes("domain_already_in_use") || hay.includes("already in use");
}

async function getVercelDomainDetails(projectId: string, domain: string, teamQS: string) {
  // GET /v9/projects/{projectId}/domains/{domain}
  return vercelFetch(
    `/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domain)}${teamQS}`,
    { method: "GET" }
  );
}

export async function POST(req: Request) {
  try {
    // 1) auth
    const user_id = await getUserIdFromRequest(supabaseAdmin, req);

    // 2) input
    const body = await req.json().catch(() => ({}));
    const rawDomain = String(body?.domain || "");
    const site_id = body?.site_id ? String(body.site_id) : null;

    const domain = normalizeDomain(rawDomain);
    if (!domain) return NextResponse.json({ error: "Invalid domain" }, { status: 400 });

    // 3) add domain to Vercel project (ONLY when user clicks Connect)
    const projectId = getProjectId();

    const teamId = process.env.VERCEL_TEAM_ID || "";
    const teamQS = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";

    const add = await vercelFetch(`/v9/projects/${encodeURIComponent(projectId)}/domains${teamQS}`, {
      method: "POST",
      body: JSON.stringify({ name: domain }),
    });

    let vercelPayload: any = add.json || add.text;
    let verified = !!add.json?.verified;
    let dns_records = extractDnsRecordsFromVercelDomain(add.json);

    // 3b) If Vercel says "already in use", treat as OK-ish and fetch details
    if (!add.res.ok) {
      const isInUse = looksAlreadyInUse(add.json, add.text);

      if (isInUse) {
        const details = await getVercelDomainDetails(projectId, domain, teamQS);

        // If we can fetch it, use that as the payload going forward
        if (details.res.ok) {
          vercelPayload = details.json || details.text;
          verified = !!details.json?.verified;
          dns_records = extractDnsRecordsFromVercelDomain(details.json);
        } else {
          // If we can't fetch details, still store the original error payload
          vercelPayload = add.json || add.text;
        }

        // Upsert as pending/verified instead of error, because "already in use" often means it exists already
        const row = await upsertCustomDomain({
          admin: supabaseAdmin,
          user_id,
          site_id,
          domain,
          status: verified ? "verified" : "pending",
          dns_records,
          vercel_verified: verified,
          vercel_payload: vercelPayload,
          last_error: null,
        });

        return NextResponse.json({
          ok: true,
          domain: row?.domain || domain,
          status: row?.status || (verified ? "verified" : "pending"),
          vercel_verified: row?.vercel_verified ?? verified,
          dns_records: row?.dns_records ?? dns_records,
          note:
            "Domain already existed in Vercel for this project. Treated as connected; check status/verify if needed.",
        });
      }

      // hard failure
      const msg =
        add.json?.error?.message ||
        add.json?.message ||
        add.json?.error ||
        `Vercel add domain failed (${add.res.status})`;

      await upsertCustomDomain({
        admin: supabaseAdmin,
        user_id,
        site_id,
        domain,
        status: "error",
        last_error: msg,
        vercel_payload: vercelPayload,
      });

      return NextResponse.json({ error: msg, details: vercelPayload }, { status: 400 });
    }

    // 4) store DB row
    const row = await upsertCustomDomain({
      admin: supabaseAdmin,
      user_id,
      site_id,
      domain,
      status: verified ? "verified" : "pending",
      dns_records,
      vercel_verified: verified,
      vercel_payload: vercelPayload,
      last_error: null,
    });

    // 5) response to UI
    return NextResponse.json({
      ok: true,
      domain: row?.domain || domain,
      status: row?.status || (verified ? "verified" : "pending"),
      vercel_verified: row?.vercel_verified ?? verified,
      dns_records: row?.dns_records ?? dns_records,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Connect failed" }, { status: 500 });
  }
}






