import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function requiredEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export function getSupabaseAdmin() {
  const url = requiredEnv("SUPABASE_URL");
  const key = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function getUserIdFromRequest(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  const token = m?.[1]?.trim();
  if (!token) throw new Error("Missing Authorization Bearer token");

  const admin = getSupabaseAdmin();

  // Use Supabase Auth to validate the JWT and get the user
  const { data, error } = await admin.auth.getUser(token);
  if (error) throw new Error(error.message);
  const userId = data?.user?.id;
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

export function normalizeDomain(input: string) {
  let d = (input || "").trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "");
  d = d.replace(/^www\./, "");
  d = d.split("/")[0] || "";
  d = d.replace(/:\d+$/, "");
  if (!d || d.length < 3) return "";
  // super basic guard
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)) return "";
  return d;
}

function vercelBase() {
  // Vercel API versions vary by endpoint; these are stable:
  // - /v9/projects/:id/domains
  // - /v9/domains/:domain/config
  return "https://api.vercel.com";
}

function teamQS() {
  const teamId = process.env.VERCEL_TEAM_ID;
  return teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
}

export async function vercelFetch(path: string, init?: RequestInit) {
  const token = requiredEnv("VERCEL_TOKEN");
  const url = `${vercelBase()}${path}${path.includes("?") ? "&" : teamQS() ? "?" : ""}${
    teamQS() ? (path.includes("?") ? teamQS().slice(1) : teamQS().slice(1)) : ""
  }`;

  const res = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
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

export function getVercelProjectId() {
  return requiredEnv("VERCEL_PROJECT_ID");
}

/**
 * Returns DNS “instructions” for the registrar based on Vercel’s config response.
 * Vercel returns shapes like:
 * - { configuredBy, misconfigured, conflicts, cnames, aValues, ... }
 * - sometimes verification info
 */
export function extractDnsRecordsFromConfig(domain: string, config: any) {
  const records: Array<{ type: string; name: string; value: string; ttl?: number }> = [];

  // Common fields Vercel can return
  const cnames = Array.isArray(config?.cnames) ? config.cnames : [];
  for (const c of cnames) {
    if (c?.name && c?.value) {
      records.push({ type: "CNAME", name: String(c.name), value: String(c.value) });
    }
  }

  // Apex A-values (often 76.76.21.21 for Vercel)
  const aValues = Array.isArray(config?.aValues) ? config.aValues : [];
  for (const v of aValues) {
    records.push({ type: "A", name: "@", value: String(v) });
  }

  // Sometimes Vercel returns an “expected” CNAME target
  if (config?.recommendedCNAME?.name && config?.recommendedCNAME?.value) {
    records.push({
      type: "CNAME",
      name: String(config.recommendedCNAME.name),
      value: String(config.recommendedCNAME.value),
    });
  }

  // If Vercel provides TXT verification (varies)
  const verification = config?.verification;
  if (verification?.type && verification?.domain && verification?.value) {
    records.push({
      type: String(verification.type).toUpperCase(),
      name: String(verification.domain),
      value: String(verification.value),
    });
  }

  // Fallback if nothing extracted: show “check config” hint
  if (records.length === 0) {
    // Give something meaningful to UI so it doesn't look broken
    records.push({
      type: "INFO",
      name: domain,
      value: "Vercel did not return explicit DNS records. Use Verify/Refresh after adding the domain in your registrar.",
    });
  }

  return records;
}
