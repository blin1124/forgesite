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

    // 1) Trigger verification on the project domain
    const verify = await vercelFetch(
      `/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domain)}/verify`,
      { method: "POST" }
    );

    // 2) Read latest status + config
    const proj = await vercelFetch(`/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domain)}`, {
      method: "GET",
    });

    const cfg = await vercelFetch(`/v9/domains/${encodeURIComponent(domain)}/config`, { method: "GET" });
    const cfgJson = cfg.json ?? {};
    const dns_records = extractDnsRecordsFromConfig(domain, cfgJson);

    const verified =
      Boolean(proj.json?.verified) ||
      Boolean(cfgJson?.verified) ||
      Boolean(cfgJson?.misconfigured === false);

    const status = verified ? "verified" : "pending";

    const last_error =
      verify.res.ok && proj.res.ok && cfg.res.ok
        ? null
        : (verify.json?.error?.message ||
            proj.json?.error?.message ||
            cfg.json?.error?.message ||
            verify.json?.message ||
            null);

    await admin
      .from("custom_domains")
      .upsert(
        {
          user_id,
          domain,
          status,
          verified,
          dns_records,
          vercel: { verify: verify.json ?? { raw: verify.text }, project: proj.json ?? null, config: cfgJson },
          last_error,
        },
        { onConflict: "user_id,domain" }
      );

    if (!verify.res.ok && !verified) {
      return jsonError(last_error || "Verification failed", 500);
    }

    return NextResponse.json({
      domain,
      status,
      verified,
      dns_records,
      vercel_verify: verify.json ?? null,
      vercel_project: proj.json ?? null,
      vercel_config: cfgJson,
    });
  } catch (e: any) {
    return jsonError(e?.message || "Connect failed", 500);
  }
}









