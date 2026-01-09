import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

/** ---------- ENV ---------- */
export function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export function getSupabaseUrl() {
  return mustEnv("SUPABASE_URL");
}
export function getServiceRoleKey() {
  return mustEnv("SUPABASE_SERVICE_ROLE_KEY");
}

/** ---------- SUPABASE ADMIN ---------- */
export function getSupabaseAdmin(): SupabaseClient {
  const url = getSupabaseUrl();
  const key = getServiceRoleKey();
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Back-compat export (older routes import `supabaseAdmin`)
 * NOTE: This creates a client once per server instance, which is fine.
 */
export const supabaseAdmin = getSupabaseAdmin();

/** ---------- AUTH HELPERS ---------- */
/**
 * Try to extract a bearer token from:
 * - Authorization: Bearer <token>
 * - cookies (common Supabase cookie names)
 */
function getTokenFromRequest(req: Request): string | null {
  const auth = req.headers.get("authorization") || "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();

  const cookie = req.headers.get("cookie") || "";
  if (!cookie) return null;

  const map = new Map<string, string>();
  cookie.split(";").forEach((part) => {
    const [k, ...rest] = part.trim().split("=");
    if (!k) return;
    map.set(k, decodeURIComponent(rest.join("=") || ""));
  });

  // Common Supabase cookie keys (varies by setup)
  const candidates = [
    "sb-access-token",
    "sb:token",
    "supabase-auth-token",
    "access_token",
  ];

  for (const k of candidates) {
    const v = map.get(k);
    if (v) return v;
  }

  // Some setups store JSON in `supabase-auth-token`
  const maybeJson = map.get("supabase-auth-token");
  if (maybeJson) {
    try {
      const parsed = JSON.parse(maybeJson);
      if (typeof parsed === "string") return parsed;
      if (Array.isArray(parsed) && parsed[0]?.access_token) return String(parsed[0].access_token);
      if (parsed?.access_token) return String(parsed.access_token);
    } catch {
      // ignore
    }
  }

  return null;
}

/**
 * NEW recommended helper:
 * Returns the authed user id using the access token in headers/cookies.
 */
export async function getUserIdFromRequest(req: Request): Promise<string> {
  const admin = getSupabaseAdmin();
  const token = getTokenFromRequest(req);
  if (!token) throw new Error("Missing auth token (cookie/Authorization).");

  const { data, error } = await admin.auth.getUser(token);
  if (error) throw new Error(error.message || "Auth getUser failed");
  const userId = data?.user?.id;
  if (!userId) throw new Error("No user on session.");
  return userId;
}

/**
 * Back-compat helper:
 * Older routes import `getUserFromCookie(admin, req)` or `getUserFromCookie(req)`
 * We support BOTH call styles.
 */
export async function getUserFromCookie(
  a: SupabaseClient | Request,
  b?: Request
): Promise<{ id: string }> {
  const req = (b ?? a) as Request;
  const userId = await getUserIdFromRequest(req);
  return { id: userId };
}

/**
 * Back-compat helper:
 * Some earlier code used `getUserIdFromAuthHeader(admin, req)`
 */
export async function getUserIdFromAuthHeader(_admin: SupabaseClient, req: Request): Promise<string> {
  return getUserIdFromRequest(req);
}

/** ---------- DOMAIN NORMALIZATION ---------- */
export function normalizeDomain(input: string) {
  const d = (input || "").trim().toLowerCase();
  if (!d) return "";
  const stripped = d.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return stripped.replace(/\.$/, "");
}

/** ---------- VERCEL ---------- */
export function getVercelToken() {
  return mustEnv("VERCEL_TOKEN");
}

export function getVercelProjectId() {
  return mustEnv("VERCEL_PROJECT_ID");
}

export async function vercelFetch(path: string, init?: RequestInit) {
  const token = getVercelToken();
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
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return { res, text, json };
}

/**
 * Convert Vercel domain config response into a simple list the UI can display.
 * Vercel returns different shapes depending on state; we normalize it.
 */
export function extractDnsRecordsFromConfig(domain: string, cfg: any) {
  const out: Array<{ type: string; name: string; value: string; ttl?: number }> = [];

  const challenges = cfg?.conflicts || cfg?.configuration?.conflicts || [];
  const records = cfg?.records || cfg?.configuration?.records || [];

  const add = (r: any) => {
    const type = String(r?.type || r?.recordType || "").toUpperCase();
    const name = String(r?.name || r?.host || "").trim();
    const value = String(r?.value || r?.data || r?.target || "").trim();
    const ttl = r?.ttl ? Number(r.ttl) : undefined;
    if (type && name && value) out.push({ type, name, value, ttl });
  };

  if (Array.isArray(records)) records.forEach(add);
  if (Array.isArray(challenges)) challenges.forEach(add);

  // As a fallback, Vercel sometimes tells you a "misconfigured" state without explicit records.
  // We keep it empty in that case; UI will show "no records yet".
  return out;
}

