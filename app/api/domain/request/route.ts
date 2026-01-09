import { NextResponse } from "next/server";
import {
  getUserFromCookie,
  isLikelyDomain,
  normalizeDomain,
  mustEnv,
  supabaseAdmin,
  vercelFetch,
} from "../_lib";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await getUserFromCookie();
    if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const raw = String(body?.domain || "");
    const domain = normalizeDomain(raw);

    if (!domain) return NextResponse.json({ error: "Missing domain" }, { status: 400 });
    if (!isLikelyDomain(domain)) return NextResponse.json({ error: "Invalid domain" }, { status: 400 });

    const projectId = mustEnv("VERCEL_PROJECT_ID");

    // 1) Add domain to project (auto-provision in Vercel)
    const add = await vercelFetch(`/v10/projects/${projectId}/domains`, {
      method: "POST",
      body: JSON.stringify({ name: domain }),
    });

    // Vercel returns 409 if already added; treat as OK
    if (!add.res.ok && add.res.status !== 409) {
      throw new Error(add.json?.error?.message || `Vercel add failed (${add.res.status}): ${add.text.slice(0, 200)}`);
    }

    // 2) Get domain status + verification challenges
    const info = await vercelFetch(`/v9/projects/${projectId}/domains/${encodeURIComponent(domain)}`, {
      method: "GET",
    });

    if (!info.res.ok) {
      throw new Error(info.json?.error?.message || `Vercel status failed (${info.res.status})`);
    }

    const verification = info.json || {};
    const status = verification?.verified ? "verified" : "awaiting_dns";

    // 3) Save in Supabase
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("custom_domains")
      .upsert(
        {
          user_id: user.id,
          domain,
          status,
          verification,
          last_error: null,
        },
        { onConflict: "user_id,domain" }
      )
      .select("id, domain, status, verification, created_at, updated_at")
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ domain: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Request failed" }, { status: 500 });
  }
}



