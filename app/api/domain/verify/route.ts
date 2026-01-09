import { NextResponse } from "next/server";
import { getUserIdFromAuthHeader, normalizeDomain, supabaseAdmin, vercelFetch, mustEnv } from "../_lib";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const admin = supabaseAdmin();
    const user_id = await getUserIdFromAuthHeader(admin, req);
    if (!user_id) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const domain = normalizeDomain(String(body?.domain || ""));
    if (!domain) return NextResponse.json({ error: "Missing domain" }, { status: 400 });

    const projectId = mustEnv("VERCEL_PROJECT_ID");

    // 1) Ask Vercel to verify now (this exists for many domain states)
    const v = await vercelFetch(`/v10/projects/${projectId}/domains/${encodeURIComponent(domain)}/verify`, {
      method: "POST",
      body: JSON.stringify({}),
    });

    // Some accounts/plans/states may not support verify endpoint;
    // we still do a GET afterwards to determine true status.
    const info = await vercelFetch(`/v10/projects/${projectId}/domains/${encodeURIComponent(domain)}`, {
      method: "GET",
    });

    if (!info.ok) {
      await admin
        .from("custom_domains")
        .update({ status: "error", last_error: info.json?.error?.message || info.text || `Vercel status failed (${info.status})` })
        .eq("user_id", user_id)
        .eq("domain", domain);

      return NextResponse.json(
        { error: info.json?.error?.message || `Vercel status failed (${info.status})`, details: info.json || info.text },
        { status: 500 }
      );
    }

    const verification = info.json;
    const isVerified = Boolean(verification?.verified) === true;

    await admin
      .from("custom_domains")
      .update({
        verification,
        verified: isVerified,
        status: isVerified ? "verified" : "pending",
        last_error: isVerified ? null : (v.ok ? null : (v.json?.error?.message || v.text || "Verify endpoint error")),
      })
      .eq("user_id", user_id)
      .eq("domain", domain);

    return NextResponse.json({
      domain,
      verified: isVerified,
      verify_call: v.ok ? v.json : { error: v.json?.error?.message || v.text || `Verify failed (${v.status})` },
      verification,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Verify failed" }, { status: 500 });
  }
}

