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
 * Verifies DNS + Vercel domain and writes results to Supabase.
 * Body:
 * { domain: string }
 *
 * NOTE:
 * If the domain is NOT yet attached to Vercel, Vercel may return 404.
 * That is NOT a fatal error in your new flow (because /request does not attach).
 */
export async function POST(req: Request) {
  try {
    const user_id = await getUserIdFromAuthHeader(supabaseAdmin, req);
    if (!user_id) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const rawDomain = String(body?.domain || "");
    const domain = normalizeDomain(rawDomain);
    if (!domain) return NextResponse.json({ error: "Invalid domain" }, { status: 400 });

    // Ensure the domain belongs to this user
    const existing = await getCustomDomainRow(supabaseAdmin, user_id, domain);
    if (!existing) {
      return NextResponse.json({ error: "Domain not found for this user" }, { status: 404 });
    }

    const projectId = getProjectId();
    const teamId = process.env.VERCEL_TEAM_ID || "";
    const teamQS = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";

    // Read-only check from Vercel
    const st = await vercelFetch(
      `/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domain)}${teamQS}`,
      { method: "GET" }
    );

    // IMPORTANT: 404 means "not attached to Vercel yet" (normal in your new flow)
    if (!st.res.ok) {
      const isNotConnected =
        st.res.status === 404 ||
        String(st.json?.error?.code || "").toLowerCase().includes("not_found") ||
        String(st.json?.error?.message || st.json?.message || st.text || "").toLowerCase().includes("not found");

      if (isNotConnected) {
        const updated = await upsertCustomDomain({
          admin: supabaseAdmin,
          user_id,
          domain,
          // keep it in a non-error state
          status: existing.status || "dns_required",
          vercel_verified: false,
          dns_records: existing.dns_records ?? null,
          // store payload for debugging but don't call it an error
          vercel_payload: st.json || st.text,
          last_error: null,
        });

        return NextResponse.json({
          ok: true,
          domain: updated?.domain || domain,
          status: updated?.status || existing.status || "dns_required",
          vercel_verified: false,
          dns_records: updated?.dns_records ?? existing.dns_records ?? [],
          note:
            "Domain is not attached to Vercel yet. Use Connect after DNS is set at your registrar, then Verify again.",
        });
      }

      // Real error (not 404)
      const msg =
        st.json?.error?.message ||
        st.json?.message ||
        st.text ||
        `Verify failed (${st.res.status})`;

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

    // Prefer Vercel’s records if present; otherwise keep whatever we already stored from /request
    const fromVercel = extractDnsRecordsFromVercelDomain(st.json) || [];
    const dns_records = fromVercel.length ? fromVercel : (existing.dns_records ?? []);

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
    return NextResponse.json({ error: err?.message || "Verify route crashed" }, { status: 500 });
  }
}








