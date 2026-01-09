import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export function normalizeDomain(input: string) {
  let d = (input || "").trim().toLowerCase();

  // remove protocol
  d = d.replace(/^https?:\/\//, "");
  // remove path/query
  d = d.split("/")[0];
  d = d.split("?")[0];
  d = d.split("#")[0];

  // remove leading www.
  d = d.replace(/^www\./, "");

  // basic safety
  d = d.replace(/[^a-z0-9.-]/g, "");
  d = d.replace(/\.\.+/g, ".");

  return d;
}

export function supabaseAdmin() {
  const url = mustEnv("SUPABASE_URL");
  const key = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * We do NOT rely on cookies (too many formats, breaks easily).
 * Browser sends Authorization: Bearer <supabase_access_token>.
 * Server uses admin.auth.getUser(token) to get user id.
 */
export async function getUserIdFromAuthHeader(admin: any, req: Request) {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  const token = m?.[1]?.trim();
  if (!token) return null;

  const { data, error } = await admin.auth.getUser(token);
  if (error) return null;

  return data?.user?.id || null;
}

export async function vercelFetch(path: string, init?: RequestInit) {
  const token = mustEnv("VERCEL_TOKEN");
  const url = `https://api.vercel.com${path}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
    // keep node fetch from caching weirdly
    cache: "no-store",
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  return { ok: res.ok, status: res.status, text, json };
}

