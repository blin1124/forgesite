import { NextResponse } from "next/server";
import {
  getUserIdFromAuthHeader,
  normalizeDomain,
  supabaseAdmin,
  vercelFetch,
  mustEnv,
  jsonErr,
  jsonOk,
} from "../_lib";

export const runtime = "nodejs";

/**
 * Request/prepare a domain connection.
 * Creates or updates a row in custom_domains, and attempts to add the domain to Vercel.
 *
 * Body: { domain: "example.com" }
 * Header: Authorization: Bearer <supabase access token>
 */
export async function POST(req: Request) {
  try {
    const user_id = await getUserIdFromAuthHeader(req);
    if (!user_id) return jsonErr("Not signed in", 401);

    const body = await req.json().catch(() => ({}));
    const domainRaw = String(body?.domain || "");
    const domain = normalizeDomain(domainRaw);

    if (!domain) return jsonErr("Please enter a valid domain (example.com).", 400);

    const projectId = mustEnv("VERCEL_PROJECT_ID");

    const admin = supabaseAdmin();

    // Ensure basic row exists (keep schema minimal)
    // Required columns: user_id, domain, status, updated_at
    await admin.from("custom_domains").upsert(
      {
        user_id,
        domain,
        status: "pending",
        updated_at: new Date().toISOString(),
      } as any,
      { onConflict: "user_id,domain" } as any
    );

    // Add to Vercel project
    const add = await vercelFetch(`/v9/projects/${projectId}/domains`, {
      method: "POST",
      body: JSON.stringify({ name: domain }),
    });

    // 409 means already added; treat as ok
    if (!add.res.ok && add.res.status !== 409) {
      const msg = add.json?.error?.message || add.json?.message || add.text || "Vercel add domain failed";
      await admin.from("custom_domains").upsert(
        {
          user_id,
          domain,
          status: "error",
          updated_at: new Date().toISOString(),
          last_error: msg,
        } as any,
        { onConflict: "user_id,domain" } as any
      );
      return jsonErr(msg, 500);
    }

    // Fetch status info from Vercel
    const st = await vercelFetch(`/v9/projects/${projectId}/domains/${encodeURIComponent(domain)}`, {
      method: "GET",
    });

    const verified = !!st.json?.verified;
    const nextStatus = verified ? "verified" : "needs_dns";

    await admin.from("custom_domains").upsert(
      {
        user_id,
        domain,
        status: nextStatus,
        vercel_verified: verified,
        vercel_payload: st.json || null,
        updated_at: new Date().toISOString(),
      } as any,
      { onConflict: "user_id,domain" } as any
    );

    return jsonOk({ domain, status: nextStatus, verified, vercel: st.json || null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Domain request failed" }, { status: 500 });
  }
}



