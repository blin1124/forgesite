import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonErr(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function noStore(res: NextResponse) {
  res.headers.set("cache-control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.headers.set("pragma", "no-cache");
  res.headers.set("expires", "0");
  return res;
}

function normalizeHost(input: string) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .split(":")[0];
}

function buildCandidates(host: string) {
  const a = host;
  const b = host.startsWith("www.") ? host.slice(4) : `www.${host}`;
  return a === b ? [a] : [a, b];
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const rawHost = url.searchParams.get("host") || "";
    const host = normalizeHost(rawHost);
    if (!host) return jsonErr("Missing host", 400);

    const admin = getSupabaseAdmin();
    const candidates = buildCandidates(host);

    let found: any = null;

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];

      const { data, error } = await admin
        .from("custom_domains")
        .select("site_id, domain, status, verified")
        .eq("domain", candidate)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) return jsonErr(error.message, 500);

      const row = data?.[0];
      if (row?.site_id) {
        found = row;
        break;
      }
    }

    if (!found) {
      return noStore(
        NextResponse.json(
          { ok: true, host, siteId: "", status: "not_found", verified: false },
          { status: 200 }
        )
      );
    }

    const status = String(found.status || "").toLowerCase();
    const verified = Boolean(found.verified);
    const siteId = String(found.site_id || "");

    const isUsable = verified || status === "verified" || status === "active";

    return noStore(
      NextResponse.json(
        {
          ok: true,
          host,
          domain: String(found.domain || host),
          status: String(found.status || ""),
          verified,
          siteId: isUsable ? siteId : "",
        },
        { status: 200 }
      )
    );
  } catch (e: any) {
    return jsonErr(e?.message || "Failed", 500);
  }
}

