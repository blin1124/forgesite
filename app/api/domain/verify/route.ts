import { NextResponse } from "next/server";
import {
  setRequestContext,
  clearRequestContext,
  getUserFromCookie,
  mustEnv,
  normalizeDomain,
  supabaseAdmin,
  vercelFetch,
  extractDnsRecordsFromConfig,
  getVercelProjectId,
} from "../_lib";

export const runtime = "nodejs";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  setRequestContext(req);
  try {
    const user = await getUserFromCookie();
    if (!user) return jsonError("Not signed in", 401);

    const body = await req.json().catch(() => ({}));
    const domain = normalizeDomain(String(body?.domain || ""));
    if (!domain) return jsonError("Missing domain", 400);

    // Ensure env exists
    mustEnv("VERCEL_TOKEN");
    const projectId = getVercelProjectId();

    // Ask Vercel for domain config (DNS records / status)
    const { res, json, text } = await vercelFetch(`/v9/projects/${projectId}/domains/${encodeURIComponent(domain)}/config`, {
      method: "GET",
    });

    if (!res.ok) {
      return jsonError(json?.error?.message || `Vercel config failed (${res.status}): ${text.slice(0, 240)}`, 500);
    }

    const records = extractDnsRecordsFromConfig(domain, json);

    // Save latest snapshot for the user+domain (optional but useful)
    // You can remove this if your schema differs.
    await supabaseAdmin
      .from("custom_domains")
      .update({
        // keep flexible — only update if columns exist in your schema
        last_checked_at: new Date().toISOString(),
        // store DNS records snapshot if you have a jsonb column named dns_records
        dns_records: records as any,
      } as any)
      .eq("user_id", user.id)
      .eq("domain", domain);

    return NextResponse.json({
      ok: true,
      domain,
      records,
      raw: json, // keep for debugging
    });
  } catch (err: any) {
    return jsonError(err?.message || "Verify route crashed", 500);
  } finally {
    clearRequestContext();
  }
}


