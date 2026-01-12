import { NextResponse } from "next/server";
import {
  extractDnsRecordsFromVercelDomain,
  getSupabaseAdmin,
  getUserIdFromRequest,
  getVercelProjectId,
  jsonErr,
  normalizeDomain,
  vercelFetch,
} from "../_lib";

export const runtime = "nodejs";

/**
 * Connect a custom domain to a site_id, create/provision it in Vercel,
 * and return DNS records needed for verification.
 *
 * Expected body: { domain: string, site_id: string }
 * Auth: Authorization: Bearer <supabase access token>
 */
export async function POST(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    const user_id = await getUserIdFromRequest(admin, req);
    if (!user_id) return jsonErr("Not signed in", 401);

    const body = await req.json().catch(() => ({}));
    const rawDomain = String(body?.domain || "");
    const site_id = String(body?.site_id || "");

    const domain = normalizeDomain(rawDomain);
    if (!domain) return jsonErr("Missing domain", 400);
    if (!site_id) return jsonErr("Missing site_id", 400);

    // 1) upsert in DB as "pending"
    const now = new Date().toISOString();

    // NOTE: this requires a table custom_domains (schema below)
    const { data: row, error: upErr } = await admin
      .from("custom_domains")
      .upsert(
        {
          user_id,
          domain,
          site_id,
          status: "pending",
          verified: false,
          updated_at: now,
        },
        { onConflict: "domain" }
      )
      .select("*")
      .single();

    if (upErr) return jsonErr(`DB upsert failed: ${upErr.message}`, 500);

    // 2) Provision in Vercel: attach domain to your ONE project
    // Vercel docs: POST /v9/projects/:id/domains
    const projectId = getVercelProjectId();

    // Create/attach domain to project
    // (If it already exists, Vercel may return an error; we tolerate by reading it after)
    try {
      await vercelFetch(`/v9/projects/${projectId}/domains`, {
        method: "POST",
        body: JSON.stringify({ name: domain }),
      });
    } catch (e: any) {
      // If it already exists, ignore and continue; otherwise throw.
      const msg = String(e?.message || "");
      const already =
        msg.toLowerCase().includes("already") ||
        msg.toLowerCase().includes("exists") ||
        msg.toLowerCase().includes("in use");
      if (!already) throw e;
    }

    // 3) Fetch domain details to extract required DNS records
    // GET /v9/projects/:id/domains/:domain
    const domainJson = await vercelFetch(`/v9/projects/${projectId}/domains/${encodeURIComponent(domain)}`, {
      method: "GET",
    });

    const dns_records = extractDnsRecordsFromVercelDomain(domainJson);

    // 4) Save dns_records in DB for the UI
    const { error: updErr } = await admin
      .from("custom_domains")
      .update({
        dns_records,
        status: "awaiting_dns",
        updated_at: now,
      })
      .eq("domain", domain);

    if (updErr) return jsonErr(`DB update failed: ${updErr.message}`, 500);

    return NextResponse.json({
      ok: true,
      domain,
      site_id,
      status: "awaiting_dns",
      dns_records,
      vercel: {
        projectId,
      },
    });
  } catch (err: any) {
    console.error("DOMAIN_CONNECT_ERROR:", err);
    return jsonErr(err?.message || "Domain connect failed", 500);
  }
}


