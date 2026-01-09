import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export function normalizeDomain(input: string) {
  return input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
}

export function isLikelyDomain(d: string) {
  // basic check; you can tighten later
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d);
}

// Supabase service role for server routes that must write regardless of RLS
export function supabaseAdmin() {
  const url = mustEnv("SUPABASE_URL");
  const key = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

// Supabase user session (for auth.uid)
export async function getUserFromCookie() {
  const url = mustEnv("SUPABASE_URL");
  const anon = mustEnv("SUPABASE_ANON_KEY");

  // Minimal cookie parsing (works if you’re using @supabase/auth-helpers-nextjs you can swap this)
  const cookieStore = cookies();
  const all = cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join("; ");

  const supabase = createClient(url, anon, {
    global: { headers: { Cookie: all } },
    auth: { persistSession: false },
  });

  const { data } = await supabase.auth.getUser();
  return data?.user || null;
}

export async function vercelFetch(path: string, init?: RequestInit) {
  const token = mustEnv("VERCEL_TOKEN");
  const teamId = process.env.VERCEL_TEAM_ID; // optional

  const url = new URL(`https://api.vercel.com${path}`);
  if (teamId) url.searchParams.set("teamId", teamId);

  const res = await fetch(url.toString(), {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
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
