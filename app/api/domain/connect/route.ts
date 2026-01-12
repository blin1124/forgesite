import { NextResponse } from "next/server";
import {
  requireUserId,
  normalizeDomain,
  jsonErr,
  jsonOk,
  mustEnv,
  vercelFetch,
  supabaseAdmin,
} from "../_lib";

export const runtime = "nodejs";

/**
 * Connect a custom domain to the Vercel project and store the result in Supabase.
 *
 * Expects JSON body:
 *  { domain: "example.com" }
 *
 * Auth:
 *  Authorization: Bearer <supabase access token>
 *
 * Env required:
 *  VERCEL_TOKEN
 *  VERCEL_PROJECT_ID   (you gave: prj_lmTrFFCheO4cW9JfRlSraCqss4pN)
 */
type VercelDomainResponse = {
  name?: string;
  apexName?: string;
  verified?: boolean;
  verification?: Array<{ type?: string; domain?: string; value?: string; reason?: string }>;
  misconfigured?: boolean;
  error?: { code?: string; message?: string };
  [k: string]: any;
};

function extractDnsInstructions(domainResp: VercelDomainResponse, domain: string) {
  // Vercel domain verify responses can include "verification" records for TXT
  const txtRecords =
    Array.isArray(domainResp.verification) && domainResp.verification.length
      ? domainResp.verification
          .filter((v) => (v?.type || "").toUpperCase() === "TXT" && v?.value)
          .map((v) => ({
            type: "TXT",
            name: v.domain || `_vercel.${domain}`,
            value: String(v.value),
          }))
      : [];

  // CNAME for subdomain (if customer uses www.example.com)
  // For apex domains (example.com), many providers require A record to 76.76.21.21
  // We'll give both options as instructions.
  const apexA = { type: "A", name: "@", value: "76.76.21.21" };
  const wwwCname = { type: "CNAME", name: "www", value: "cname.vercel-dns.com" };

  return { txtRecords, apexA, wwwCname };
}

export async function POST(req: Request) {
  try {
    // 1) Auth user (supabase token)
    const user_id = await requireUserId(req);

    // 2) Parse body
    const body = await req.json().catch(() => ({}));
    const rawDomain = String(body?.domain || "");
    const domain = normalizeDomain(rawDomain);

    if (!domain || domain.length < 3 || !domain.includes(".")) {
      return jsonErr("Please enter a valid domain (example.com).", 400);
    }

    // 3) Required env
    const projectId = mustEnv("VERCEL_PROJECT_ID");

    // 4) Upsert initial row in Supabase (status = pending)
    const admin = supabaseAdmin();

    // Store row first so UI can show it immediately
    const { error: dbUpErr } = await admin.from("custom_domains").upsert(
      {
        user_id,
        domain,
        status: "pending",
        updated_at: new Date().toISOString(),
      } as any,
      { onConflict: "user_id,domain" } as any
    );

    if (dbUpErr) return jsonErr(`DB error: ${dbUpErr.message}`, 500);

    // 5) Add domain to Vercel project
    // POST /v9/projects/{projectId}/domains
    const add = await vercelFetch(`/v9/projects/${projectId}/domains`, {
      method: "POST",
      body: JSON.stringify({ name: domain }),
    });

    // If domain already exists, Vercel may return 409; treat as ok and continue
    if (!add.res.ok && add.res.status !== 409) {
      const msg = add.json?.error?.message || add.json?.message || add.text || "Vercel add domain failed";
      await admin
        .from("custom_domains")
        .upsert(
          { user_id, domain, status: "error", last_error: msg, updated_at: new Date().toISOString() } as any,
          { onConflict: "user_id,domain" } as any
        );
      return jsonErr(msg, 500);
    }

    // 6) Fetch domain status from Vercel (includes verified + verification records)
    // GET /v9/projects/{projectId}/domains/{domain}
    const status = await vercelFetch(`/v9/projects/${projectId}/domains/${encodeURIComponent(domain)}`, {
      method: "GET",
    });

    // If that fails, still return success but show generic instructions
    const domainResp: VercelDomainResponse = status.json || {};

    const verified = !!domainResp.verified;
    const { txtRecords, apexA, wwwCname } = extractDnsInstructions(domainResp, domain);

    // 7) Save status + dns instructions in Supabase
    const nextStatus = verified ? "verified" : "needs_dns";

    const { error: dbErr } = await admin
      .from("custom_domains")
      .upsert(
        {
          user_id,
          domain,
          status: nextStatus,
          vercel_verified: verified,
          vercel_payload: domainResp,
          dns_txt: txtRecords,
          dns_apex: apexA,
          dns_www: wwwCname,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: "user_id,domain" } as any
      );

    if (dbErr) return jsonErr(`DB error: ${dbErr.message}`, 500);

    return jsonOk({
      domain,
      status: nextStatus,
      verified,
      dns: {
        txt: txtRecords,
        apexA,
        wwwCname,
      },
      vercel: domainResp,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Connect domain failed" }, { status: 500 });
  }
}



