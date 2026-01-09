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

    const info = await vercelFetch(`/v10/projects/${projectId}/domains/${encodeURIComponent(domain)}`, { method: "GET" });
    if (!info.ok) {
      return NextResponse.json({ error: info.json?.error?.message || `Vercel status failed (${info.status})`, details: info.json || info.text }, { status: 500 });
    }

    const verification = info.json;
    const isVerified = Boolean(verification?.verified) === true;

    // Update DB row if it exists for this user/domain
    await admin
      .from("custom_domains")
      .update({
        verification,
        verified: isVerified,
        status: isVerified ? "verified" : "pending",
        last_error: null,
      })
      .eq("user_id", user_id)
      .eq("domain", domain);

    return NextResponse.json({
      domain,
      verified: isVerified,
      verification,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Status failed" }, { status: 500 });
  }
}
