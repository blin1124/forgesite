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
    if (!domain) return jsonError("Enter a valid domain (example: yourbusiness.com)", 400);

    const projectId = getVercelProjectId();

    // 1) Attach the domain to your project (auto-provision step)
    const add = await vercelFetch(`/v9/projects/${encodeURIComponent(projectId)}/domains`, {
      method: "POST",
      body: JSON.stringify({ name: domain }),
    });

    // Vercel returns 409 if already added; treat as OK
    if (!add.res.ok && add.res.status !== 409) {
      const msg = add.json?.error?.message || add.json?.message || add.text || "Vercel add-domain failed";
      await admin
        .from("custom_domains")
        .upsert(
          {
            user_id,
            domain,
            status: "failed",
            verified: false,
            last_error: msg,
            vercel: add.json ?? { raw: add.text },
          },
          { onConflict: "user_id,domain" }
        );
      return jsonError(msg, 500);
    }

    // 2) Ask Vercel for DNS config needed for verification
    const cfg = await vercelFetch(`/v9/domains/${encodeURIComponent(domain)}/config`, { method: "GET" });
    const cfgJson = cfg.json ?? {};
    const dns_records = extractDnsRecordsFromConfig(domain, cfgJson);

    // 3) Store domain row
    await admin
      .from("custom_domains")
      .upsert(
        {
          user_id,
          domain,
          status: "pending",
          verified: false,
          dns_records,
          vercel: { add: add.json ?? { ok: true }, config: cfgJson },
          last_error: null,
        },
        { onConflict: "user_id,domain" }
      );

    return NextResponse.json({
      domain,
      status: "pending",
      verified: false,
      dns_records,
      vercel_config: cfgJson,
    });
  } catch (e: any) {
    return jsonError(e?.message || "Request failed", 500);
  }
}








