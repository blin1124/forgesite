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
  // de-dupe without Set
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

    let found:
      | { site_id: string; domain: string; st_
