import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function normalizeDomain(raw: string) {
  const s = (raw || "").trim().toLowerCase();
  if (!s) return "";
  return s.replace(/^https?:\/\//, "").split("/")[0];
}

/**
 * Step 4 placeholder:
 * For now we generate *generic* DNS instructions (A + CNAME).
 * Later we’ll replace this with real Vercel API calls.
 */
function makePlaceholderDns(domain: string) {
  return {
    domain,
    records: [
      { type: "A", name: "@", value: "76.76.21.21", note: "apex root points to hosting" },
      { type: "CNAME", name: "www", value: "cname.vercel-dns.com", note: "www points to hosting" },
    ],
    note:
      "These are placeholder records for the customer flow. In Step 4 you’ll replace this with exact records returned by your hosting provider API.",
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const domain = normalizeDomain(String(body?.domain || ""));
    if (!domain) return jsonError("Missing domain", 400);

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) return jsonError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY", 500);

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const dns_records = makePlaceholderDns(domain);

    // For now, user_id is null/empty unless you wire it.
    const { data, error } = await supabase
      .from("custom_domains")
      .upsert(
        {
          domain,
          status: "pending",
          verified: false,
          dns_records,
          last_error: null,
        },
        { onConflict: "domain" }
      )
      .select("id,domain,status,verified,dns_records")
      .single();

    if (error) return jsonError(error.message, 500);

    return NextResponse.json(data);
  } catch (err: any) {
    return jsonError(err?.message || "Request crashed", 500);
  }
}

