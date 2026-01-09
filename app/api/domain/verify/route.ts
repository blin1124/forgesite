import { NextResponse } from "next/server";
import { getUserFromCookie, mustEnv, normalizeDomain, supabaseAdmin, vercelFetch } from "../_lib";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await getUserFromCookie();
    if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const domain = normalizeDomain(String(body?.domain || ""));
    if (!domain) return NextResponse.json({ error: "Missing domain" }, { status: 400 });

    const projectId = mustEnv("VERCEL_PROJECT_ID");

    // Some Vercel flows re-check automatically; we just refetch status
    const info = await vercelFetch(`/v9/projects/${projectId}/domains/${encodeURIComponent(domain)}`, {
      method: "GET",
    });

    if (!info.res.ok) {
      throw new Error(info.json?.error?.message || `Vercel verify check failed (${info.res.status})`);
    }

    const verification = info.json || {};
    const status = verification?.verified ? "verified" : "awaiting_dns";

    const db = supabaseAdmin();
    await db
      .from("custom_domains")
      .update({
        status,
        verification,
        last_error: null,
      })
      .eq("user_id", user.id)
      .eq("domain", domain);

    return NextResponse.json({ status, verification });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Verify failed" }, { status: 500 });
  }
}
