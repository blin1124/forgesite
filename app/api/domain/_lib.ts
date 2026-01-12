import { NextResponse } from "next/server";
import { supabaseAdmin as _supabaseAdmin } from "@/lib/supabase/admin";

export function jsonErr(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function jsonOk(data: any) {
  return NextResponse.json(data);
}

export function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export function getProjectId() {
  return mustEnv("VERCEL_PROJECT_ID");
}

export function supabaseAdmin() {
  return _supabaseAdmin();
}

export function normalizeDomain(input: string) {
  const raw = (input || "").trim().toLowerCase();
  const noProto = raw.replace(/^https?:\/\//, "").split("/")[0].trim();
  const d = noProto.replace(/^www\./, "");

  if (!d || d.length < 3) return "";
  if (!d.includes(".")) return "";
  if (/\s/.test(d)) return "";
  if (!/^[a-z0-9.-]+$/.test(d)) return "";

  return d;
}

export async function vercelFetch(path: string, init?: RequestInit) {
  const token = mustEnv("VERCEL_TOKEN");
  const url = `https://api.vercel.com${path}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  return { res, text, json };
}

/**
 * Get signed-in user id using Authorization: Bearer <supabase access token>
 */
export async function getUserIdFromAuthHeader(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice("Bearer ".length).trim()
    : "";

  if (!token) return null;

  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user?.id) return null;
  return data.user.id;
}

export async function requireUserId(req: Request) {
  const uid = await getUserIdFromAuthHeader(req);
  if (!uid) throw new Error("Not signed in");
  return uid;
}

/**
 * Read the domain row (for this user + domain)
 */
export async function getCustomDomainRow(user_id: string, domain: string) {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("custom_domains")
    .select("*")
    .eq("user_id", user_id)
    .eq("domain", domain)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as any;
}

/**
 * Upsert into custom_domains with a safe, flexible payload.
 * If your table doesn't have some optional columns, remove them from the payload here.
 */
export async function upsertCustomDomain(payload: Record<string, any>) {
  const admin = supabaseAdmin();

  // Required keys:
  if (!payload.user_id) throw new Error("upsertCustomDomain missing user_id");
  if (!payload.domain) throw new Error("upsertCustomDomain missing domain");

  const row = {
    ...payload,
    updated_at: payload.updated_at || new Date().toISOString(),
  };

  const { data, error } = await admin
    .from("custom_domains")
    .upsert(row as any, { onConflict: "user_id,domain" } as any)
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as any;
}

/**
 * Extract "what DNS should they set" from the Vercel domain config response.
 * Vercel commonly returns `apexName`, `name`, `verified`, and a `verification` array.
 * We'll normalize it into a simple list your UI can show.
 */
export function extractDnsRecordsFromVercelDomain(vercelDomainJson: any) {
  const records: Array<{
    type: "A" | "CNAME" | "TXT";
    name: string;
    value: string;
    ttl?: number;
    note?: string;
  }> = [];

  const name = String(vercelDomainJson?.name || "");
  const apex = String(vercelDomainJson?.apexName || "");

  // Vercel sometimes includes instructions under `verification`
  const verification = Array.isArray(vercelDomainJson?.verification)
    ? vercelDomainJson.verification
    : [];

  for (const v of verification) {
    // common shapes: { type: 'TXT', domain: '_vercel', value: 'token' } etc.
    const type = String(v?.type || "").toUpperCase();
    const recType = (type === "TXT" || type === "A" || type === "CNAME") ? type : "";

    const recName = String(v?.domain || v?.name || "");
    const value = String(v?.value || "");

    if (recType && recName && value) {
      records.push({
        type: recType as any,
        name: recName,
        value,
        note: "From Vercel verification requirements",
      });
    }
  }

  // Fallbacks if verification array is empty:
  // Typical Vercel pattern: point your domain to Vercel via CNAME for subdomain,
  // or A record to 76.76.21.21 for apex. (Commonly used by Vercel, but can change.)
  // We'll only include these as "suggestions" if Vercel didn't provide specifics.
  if (records.length === 0 && name) {
    const isApex = apex && name === apex;

    if (isApex) {
      records.push({
        type: "A",
        name: "@",
        value: "76.76.21.21",
        note: "Typical Vercel apex A record (fallback). Prefer Vercel-provided instructions if available.",
      });
    } else {
      records.push({
        type: "CNAME",
        name: name.split(".")[0] || "www",
        value: "cname.vercel-dns.com",
        note: "Typical Vercel CNAME (fallback). Prefer Vercel-provided instructions if available.",
      });
    }
  }

  return records;
}









