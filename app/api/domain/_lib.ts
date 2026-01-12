import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Small shared helpers for domain routes.
 * Important goal: STOP type hell by not over-typing Supabase generics.
 */

export function jsonOk(data: any = {}, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonErr(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function normalizeDomain(input: string) {
  const d = String(input || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
  return d;
}

/**
 * Backward compatible export name:
 * Some routes import `supabaseAdmin` directly.
 * We expose a *function* but also a *value* for compatibility.
 */
export function supabaseAdmin() {
  return getSupabaseAdmin();
}

/**
 * requireUserId:
 * Reads Authorization: Bearer <supabase access token>
 * and returns the Supabase user id.
 *
 * Use this for any /api/domain/* route called from the browser.
 */
export async function requireUserId(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  if (!token) throw new Error("Auth session missing");

  const admin = getSupabaseAdmin();

  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  const user = userData?.user;

  if (userErr || !user) throw new Error("Invalid session");

  return user.id;
}

/**
 * If you ever need the admin client directly
 */
export function getSupabaseAdmin() {
  return getSupabaseAdmin();
}

/**
 * Keep this exported so old imports don't break:
 * `mustEnv("NAME")`
 */
export function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

/**
 * Minimal Vercel fetch helper (kept generic).
 * If you already have another version elsewhere, keep this one here for domain routes.
 */
export async function vercelFetch(path: string, init?: RequestInit) {
  const token = mustEnv("VERCEL_TOKEN");
  const url = path.startsWith("http") ? path : `https://api.vercel.com${path}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
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






