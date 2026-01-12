import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// ---------- small helpers ----------
export function jsonErr(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export function normalizeDomain(input: string) {
  const d = String(input || "").trim().toLowerCase();
  if (!d) return "";
  // strip protocol + path if someone pasted it
  const cleaned = d
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .trim()
    .toLowerCase();
  return cleaned;
}

// ---------- supabase admin ----------
export function getSupabaseAdmin() {
  const url = mustEnv("SUPABASE_URL");
  const key = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

// ---------- auth from request ----------
export async function getUserIdFromRequest(admin: SupabaseClient, req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  if (!token) return null;

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user.id;
}

// ---------- vercel ----------
export function getVercelToken() {
  return mustEnv("VERCEL_TOKEN");
}

export function getVercelProjectId() {
  // you provided: prj_lmTrFFCheO4cW9JfRlSraCqss4pN
  // store it in env: VERCEL_PROJECT_ID
  return mustEnv("VERCEL_PROJECT_ID");
}

export async function vercelFetch(path: string, init?: RequestInit) {
  const token = getVercelToken();
  const base = "https://api.vercel.com";
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const text = await res.text();
  let json: any = {};
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const msg =
      json?.error?.message ||
      json?.message ||
      `Vercel API error ${res.status}: ${text.slice(0, 200)}`;
    throw new Error(msg);
  }

  return json;
}

/**
 * Pull DNS instructions from Vercel "domain config" style responses.
 * We accept different shapes because Vercel responses can vary.
 */
export function extractDnsRecordsFromVercelDomain(domainJson: any): any[] {
  // common candidates:
  // - domainJson?.config?.misconfigured / configured
  // - domainJson?.verification / verified / verificationRecords
  // - domainJson?.requiredDnsRecords
  // - domainJson?.nameservers
  const records =
    domainJson?.requiredDnsRecords ||
    domainJson?.verificationRecords ||
    domainJson?.config?.requiredDnsRecords ||
    domainJson?.config?.verificationRecords ||
    [];

  if (Array.isArray(records)) return records;

  // sometimes it's an object map
  if (records && typeof records === "object") return [records];

  return [];
}




