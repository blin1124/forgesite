import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabase/admin";

export function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export function normalizeDomain(raw: string): string {
  const d = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "");

  // allow wildcard input too (for *.forgesite.net)
  return d;
}

export async function getUserFromCookie() {
  const cookieStore = cookies();

  const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anon = mustEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  const sb = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // Route handlers don't need to set cookies for our usage here.
      },
    },
  });

  const { data, error } = await sb.auth.getUser();
  if (error) return null;
  return data.user ?? null;
}

export async function requireUserId() {
  const user = await getUserFromCookie();
  if (!user) throw new Error("Not signed in");
  return user.id;
}

function vercelHeaders() {
  return {
    Authorization: `Bearer ${mustEnv("VERCEL_TOKEN")}`,
    "Content-Type": "application/json",
  };
}

export async function vercelFetch(path: string, init?: RequestInit) {
  const res = await fetch(`https://api.vercel.com${path}`, {
    ...init,
    headers: { ...vercelHeaders(), ...(init?.headers || {}) },
    cache: "no-store",
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  if (!res.ok) {
    const msg =
      json?.error?.message ||
      json?.message ||
      `${res.status} ${res.statusText}: ${text.slice(0, 200)}`;
    throw new Error(msg);
  }

  return json;
}

export function getProjectId() {
  return mustEnv("VERCEL_PROJECT_ID");
}

export function extractDnsRecordsFromVercelDomain(vercelDomainObj: any) {
  // Vercel returns shapes that vary slightly.
  // We normalize into a predictable array.
  const records: any[] = [];

  const v = vercelDomainObj?.verification;
  if (Array.isArray(v)) {
    for (const r of v) {
      records.push({
        type: r.type || r.recordType || "TXT",
        name: r.domain || r.name || r.record || r.target || "",
        value: r.value || r.expectedValue || r.target || "",
        reason: r.reason || "",
      });
    }
  }

  // Some responses include `cnames` or `nameservers` etc — we keep raw `verification` too.
  return records;
}

export async function upsertCustomDomain(args: {
  user_id: string;
  site_id?: string | null;
  domain: string;
  status?: string;
  verified?: boolean;
  dns_records?: any;
  verification?: any;
}) {
  const admin = supabaseAdmin();

  const payload: any = {
    user_id: args.user_id,
    domain: args.domain,
    site_id: args.site_id ?? null,
    status: args.status ?? "pending",
    verified: args.verified ?? false,
    dns_records: args.dns_records ?? null,
    verification: args.verification ?? null,
    updated_at: new Date().toISOString(),
  };

  // If row doesn't exist yet, created_at default will handle it.
  const { data, error } = await admin
    .from("custom_domains")
    .upsert(payload, { onConflict: "user_id,domain" })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function getCustomDomainRow(user_id: string, domain: string) {
  const admin = supabaseAdmin();

  const { data, error } = await admin
    .from("custom_domains")
    .select("*")
    .eq("user_id", user_id)
    .eq("domain", domain)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export function jsonOk(body: any) {
  return NextResponse.json(body, { status: 200 });
}

export function jsonErr(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}



