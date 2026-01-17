import { NextResponse } from "next/server";
import {
  supabaseAdmin,
  getUserIdFromAuthHeader,
  normalizeDomain,
  mustEnv,
  vercelFetch,
  extractDnsRecordsFromVercelDomain,
  upsertCustomDomain,
  getProjectId,
} from "../_lib";

export const runtime = "nodejs";

/**
 * Request a custom domain:
 * - verifies user via Authorization: Bearer <supabase access token>
 * - adds domain to Vercel project
 * - stores row in custom_domains with dns_records, vercel_payload, last_error
 *
 * Body:
 * { domain: string, site_id?: string }
 */
export async function POST(req: Request) {
  try {
    // ✅ FIX: pass (admin, req)
    const user_id = await getUserIdFromAuthHeader(supabaseAdmin, req);

    const body = await req.json().catch(() => ({}));
    const domainRaw = String(body?.domain || "");
    const site_id = body?.site_id ? String(body.site_id) : null;

    const domain = normalizeDomain(domainRaw);
    if (!domain) {
      return NextResponse.json({ error: "Invalid domain" }, { status: 400 });
    }

    // Vercel project
    const projectId = getProjectId();

    // Optional team support later
    const teamId = process.env.VERCEL_TEAM_ID || "";
    const teamQS = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";

    // Add domain to Vercel project
    const add = await vercelFetch(`/v9/projects/${encodeURIComponent(projectId)}/domains${teamQS}`, {
      method: "POST",
      body: JSON.stringify({ name: domain }),
    });

    if (!add.res.ok) {
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

    const dns_records = extractDnsRecordsFromVercelDomain(add.json);
    const verified = !!add.json?.verified;

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

    return NextResponse.json({
      ok: true,
      domain: row?.domain || domain,
      status: row?.status || (verified ? "verified" : "pending"),
      vercel_verified: row?.vercel_verified ?? verified,
      dns_records: row?.dns_records ?? dns_records,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Request failed" }, { status: 500 });
  }
}









