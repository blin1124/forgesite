// app/api/domain/status/route.ts
import { NextResponse } from "next/server";
import { getUserFromCookie, mustEnv, normalizeDomain, vercelFetch } from "../_lib";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const user = await getUserFromCookie();
    if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const url = new URL(req.url);
    const domain = normalizeDomain(url.searchParams.get("domain") || "");
    if (!domain) return NextResponse.json({ error: "Missing domain" }, { status: 400 });

    const projectId = mustEnv("VERCEL_PROJECT_ID");

    const info = await vercelFetch(`/v9/projects/${projectId}/domains/${encodeURIComponent(domain)}`, {
      method: "GET",
    });

    if (!info.res.ok) {
      throw new Error(info.json?.error?.message || `Vercel status failed (${info.res.status})`);
    }

    return NextResponse.json({ verification: info.json });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Status failed" }, { status: 500 });
  }
}



