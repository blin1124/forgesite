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

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const rawHost = url.searchParams.get("host") || "";
    const host = normalizeHost(rawHost);
    if (!host) return jsonErr("Missing host", 400);

    const admin = getSupabaseAdmin();

    // Try exact, then www<->apex fallback
    const candidates = new Set<string>([host]);
    if (host.startsWith("www.")) candidates.add(host.slice(4));
    else candidates.add(`www.${host}`);

    let found:
      | { site_id: string; domain: string; status: string | null; verified: boolean | null }
      | null = null;

    for (const candidate of candidates) {
      const { data, error } = await admin
        .from("custom_domains")
        .select("site_id, domain, status, verified")
        .eq("domain", candidate)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) return jsonErr(error.message, 500);

      const row = data?.[0];
      if (row?.site_id) {
        found = {
          site_id: String(row.site_id),
          domain: String(row.domain || candidate),
          status: row.status ?? null,
          verified: row.verified ?? null,
        };
        break;
      }
    }

    if (!found) {
      return noStore(
        NextResponse.json({ ok: true, host, siteId: "", status: "not_found", verified: false }, { status: 200 })
      );
    }

    const status = String(found.status || "").toLowerCase();
    const verified = Boolean(found.verified);

    // ✅ usable if boolean verified OR status indicates ready
    const isUsable = verified || status === "verified" || status === "active";

    return noStore(
      NextResponse.json(
        {
          ok: true,
          host,
          domain: found.domain,
          status: found.status || "",
          verified,
          siteId: isUsable ? found.site_id : "",
        },
        { status: 200 }
      )
    );
  } catch (e: any) {
    return jsonErr(e?.message || "Failed", 500);
  }
}
