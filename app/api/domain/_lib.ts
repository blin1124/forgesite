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

/** Back-compat export (older routes import `supabaseAdmin`) */
export const supabaseAdmin = getSupabaseAdmin();

/** ---------- REQUEST CONTEXT (for zero-arg helpers) ---------- */
let _currentReq: Request | null = null;

/**
 * Back-compat: allow routes to set the "current request" once,
 * so helpers like getUserFromCookie() can be called with 0 args.
 */
export function setRequestContext(req: Request) {
  _currentReq = req;
}
export function clearRequestContext() {
  _currentReq = null;
}
function requireReqFromContext(): Request {
  if (!_currentReq) throw new Error("Missing request context. Call setRequestContext(req) first.");
  return _currentReq;
}

/** ---------- AUTH HELPERS ---------- */
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

  const candidates = ["sb-access-token", "sb:token", "supabase-auth-token", "access_token"];
  for (const k of candidates) {
    const v = map.get(k);
    if (v) return v;
  }

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
 * ✅ Back-compat helper with ALL call styles:
 * - getUserFromCookie()
 * - getUserFromCookie(req)
 * - getUserFromCookie(admin, req)
 */
export async function getUserFromCookie(): Promise<{ id: string } | null>;
export async function getUserFromCookie(req: Request): Promise<{ id: string } | null>;
export async function getUserFromCookie(admin: SupabaseClient, req: Request): Promise<{ id: string } | null>;
export async function getUserFromCookie(
  a?: SupabaseClient | Request,
  b?: Request
): Promise<{ id: string } | null> {
  let req: Request;

  // 0-arg: use request context
  if (!a) {
    req = requireReqFromContext();
  } else if (a instanceof Request) {
    // 1-arg: a is req
    req = a;
  } else {
    // 2-arg: (admin, req) - admin is unused, but supported
    req = b as Request;
  }

  try {
    const userId = await getUserIdFromRequest(req);
    return { id: userId };
  } catch {
    return null;
  }
}

/** Back-compat helper: older code used getUserIdFromAuthHeader(admin, req) */
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

export function extractDnsRecordsFromConfig(_domain: string, cfg: any) {
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

  return out;
}

