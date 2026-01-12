import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

/** ---------- response helpers ---------- */
export function jsonErr(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function jsonOk(payload: any = {}) {
  return NextResponse.json(payload);
}

/** ---------- env helpers ---------- */
export function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

/** ---------- supabase admin ---------- */
export function getSupabaseAdminClient() {
  return getSupabaseAdmin();
}

/** Back-compat name (some of your routes may import getSupabaseAdmin) */
export function getSupabaseAdmin() {
  return getSupabaseAdminClient();
}

/** ---------- auth helpers ---------- */
export async function getUserIdFromRequest(admin: SupabaseClient, req: Request): Promise<string> {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  if (!token) throw new Error("Missing Authorization Bearer token");

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user?.id) throw new Error("Invalid session");

  return data.user.id;
}

/** Alias some routes may still use */
export async function getUserIdFromAuthHeader(admin: SupabaseClient, req: Request): Promise<string> {
  return getUserIdFromRequest(admin, req);
}

/** Preferred helper used by some routes */
export async function requireUserId(req: Request): Promise<string> {
  const admin = getSupabaseAdminClient();
  return getUserIdFromRequest(admin, req);
}

/** ---------- domain helpers ---------- */
export function normalizeDomain(input: string) {
  let d = (input || "").trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "");
  d = d.replace(/^www\./, "");
  d = d.split("/")[0];
  d = d.replace(/\.+$/, "");
  if (!d || d.includes(" ")) return "";
  return d;
}

/** ---------- vercel helpers ---------- */
export async function vercelFetch(path: string, init?: RequestInit) {
  const token = mustEnv("VERCEL_TOKEN");
  const base = "https://api.vercel.com";

  const res = await fetch(base + path, {
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

export function getProjectId() {
  // You told me you have the Project ID already:
  // prj_lmTrFFCheO4cW9JfRlSraCqss4pN
  // But we still read from env to keep prod/dev clean.
  return mustEnv("VERCEL_PROJECT_ID");
}

/** Some files might call getVercelProjectId */
export function getVercelProjectId() {
  return getProjectId();
}

/**
 * Pull “required DNS records” out of Vercel domain response.
 * Vercel's API returns a `verification` array and/or `verified` flags.
 * We'll normalize into a simple array.
 */
export function extractDnsRecordsFromVercelDomain(vercelDomainJson: any) {
  const out: Array<{
    type: string;
    name: string;
    value: string;
    reason?: string;
  }> = [];

  const verification = vercelDomainJson?.verification;
  if (Array.isArray(verification)) {
    for (const v of verification) {
      const type = String(v?.type || "").toUpperCase();
      const domain = String(v?.domain || "");
      const value = String(v?.value || "");
      const reason = v?.reason ? String(v.reason) : undefined;
      if (type && domain && value) out.push({ type, name: domain, value, reason });
    }
  }

  // Some responses include a `verification` object or other fields; keep it safe.
  return out;
}

/** Alias some of your routes referenced */
export function extractDnsRecordsFromVercelDomainAlias(vercelDomainJson: any) {
  return extractDnsRecordsFromVercelDomain(vercelDomainJson);
}

/** Match the name your routes complained about earlier */
export const extractDnsRecordsFromVercelDomain =
  extractDnsRecordsFromVercelDomainAlias as unknown as (j: any) => any[];

/** ---------- DB helpers (custom_domains) ---------- */
export async function getCustomDomainRow(admin: SupabaseClient, user_id: string, domain: string) {
  const { data, error } = await admin
    .from("custom_domains")
    .select("*")
    .eq("user_id", user_id)
    .eq("domain", domain)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function upsertCustomDomain(args: {
  admin: SupabaseClient;
  user_id: string;
  site_id?: string | null;
  domain: string;
  status?: string | null;
  dns_records?: any[] | null;
  vercel_verified?: boolean | null;
  vercel_payload?: any | null;
  last_error?: string | null;
}) {
  const {
    admin,
    user_id,
    site_id = null,
    domain,
    status = "pending",
    dns_records = null,
    vercel_verified = null,
    vercel_payload = null,
    last_error = null,
  } = args;

  const payload: any = {
    user_id,
    site_id,
    domain,
    status,
    dns_records,
    vercel_verified,
    vercel_payload,
    last_error,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await admin
    .from("custom_domains")
    .upsert(payload, { onConflict: "user_id,domain" })
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data;
}










