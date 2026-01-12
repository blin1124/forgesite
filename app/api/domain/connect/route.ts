import { NextResponse } from "next/server";
import {
  supabaseAdmin,
  getUserIdFromRequest,
  normalizeDomain,
  mustEnv,
  vercelFetch,
  extractDnsRecordsFromVercelDomain,
  upsertCustomDomain,
  getProjectId,
} from "../_lib";

export const runtime = "nodejs";

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

    // 3) add domain to Vercel project
    // Vercel API: POST /v9/projects/{projectId}/domains
    const projectId = getProjectId();

    // Optional: if you use a team later, set VERCEL_TEAM_ID and add ?teamId=
    const teamId = process.env.VERCEL_TEAM_ID || "";
    const teamQS = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";

    const add = await vercelFetch(`/v9/projects/${encodeURIComponent(projectId)}/domains${teamQS}`, {
      method: "POST",
      body: JSON.stringify({ name: domain }),
    });

    if (!add.res.ok) {
      const msg =
        add.json?.error?.message ||
        add.json?.message ||
        `Vercel add domain failed (${add.res.status})`;
      // store error for debugging in DB
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

    // 4) extract DNS records Vercel wants for verification (if any)
    const dns_records = extractDnsRecordsFromVercelDomain(add.json);
    const verified = !!add.json?.verified;

    // 5) upsert in DB
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

    // 6) response to UI
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




