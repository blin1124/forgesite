import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Small shared helpers for domain routes.
 * Goal: stable exports so routes stop breaking.
 */

export function jsonOk(data: any = {}, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonErr(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export function normalizeDomain(input: string) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

/**
 * Backwards compatibility:
 * Some older routes may still import `supabaseAdmin`.
 * We expose it as a function that returns the admin client.
 */
export function supabaseAdmin() {
  return getSupabaseAdmin();
}

/**
 * Reads Authorization: Bearer <supabase access token>
 * and returns the Supabase user id.
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
 * Minimal Vercel fetch helper for domain endpoints.
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






