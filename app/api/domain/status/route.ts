import { NextResponse } from "next/server";
import {
  extractDnsRecordsFromConfig,
  getSupabaseAdmin,
  getUserIdFromRequest,
  getVercelProjectId,
  normalizeDomain,
  vercelFetch,
} from "../_lib";

export const runtime = "nodejs";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    const user_id = await getUserIdFromRequest(req);

    const body = await req.json().catch(() => ({}));
    const domain = normalizeDomain(String(body?.domain || ""));
    if (!domain) return jsonError("Missing domain", 400);

    const projectId = getVercelProjectId();

    // Read from project-domain endpoint
    const proj = await vercelFetch(`/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domain)}`, {
      method: "GET",
    });

    // DNS config endpoint
    const cfg = await vercelFetch(`/v9/domains/${encodeURIComponent(domain)}/config`, { method: "GET" });
    const cfgJson = cfg.json ?? {};
    const dns_records = extractDnsRecordsFromConfig(domain, cfgJson);

    // Determine “verified” best-effort
    const verified =
      Boolean(proj.json?.verified) ||
      Boolean(cfgJson?.verified) ||
      Boolean(cfgJson?.misconfigured === false);

    const status = verified ? "verified" : "pending";

    await admin
      .from("custom_domains")
      .upsert(
        {
          user_id,
          domain,
          status,
          verified,
          dns_records,
          vercel: { project: proj.json ?? { raw: proj.text }, config: cfgJson },
          last_error: proj.res.ok && cfg.res.ok ? null : (proj.json?.error?.message || cfg.json?.error?.message || null),
        },
        { onConflict: "user_id,domain" }
      );

    return NextResponse.json({
      domain,
      status,
      verified,
      dns_records,
      vercel_project: proj.json ?? null,
      vercel_config: cfgJson,
    });
  } catch (e: any) {
    return jsonError(e?.message || "Status failed", 500);
  }
}









