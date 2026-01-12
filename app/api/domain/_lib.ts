import { NextResponse } from "next/server";
import { supabaseAdmin as _supabaseAdmin } from "@/lib/supabase/admin";

export function jsonErr(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function jsonOk(data: any) {
  return NextResponse.json(data);
}

export function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export function normalizeDomain(input: string) {
  const raw = (input || "").trim().toLowerCase();

  // strip protocol + path
  const noProto = raw.replace(/^https?:\/\//, "").split("/")[0].trim();

  // strip leading www. for normalization (optional; you can remove this if you want to allow www domains separately)
  const d = noProto.replace(/^www\./, "");

  // basic sanity
  if (!d || d.length < 3) return "";
  if (!d.includes(".")) return "";
  if (/\s/.test(d)) return "";
  if (!/^[a-z0-9.-]+$/.test(d)) return "";

  return d;
}

// Re-export admin client in the shape routes expect:
export function supabaseAdmin() {
  return _supabaseAdmin();
}

/**
 * Pull user id from Authorization Bearer token using service role auth.getUser(token)
 * This is what your routes were trying to do under different helper names.
 */
export async function getUserIdFromAuthHeader(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice("Bearer ".length).trim()
    : "";

  if (!token) return null;

  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user?.id) return null;

  return data.user.id;
}

/**
 * Hard requirement: must have a valid bearer token user id or throws.
 */
export async function requireUserId(req: Request) {
  const uid = await getUserIdFromAuthHeader(req);
  if (!uid) throw new Error("Not signed in");
  return uid;
}

/**
 * Minimal Vercel fetch wrapper.
 * Requires VERCEL_TOKEN env.
 */
export async function vercelFetch(path: string, init?: RequestInit) {
  const token = mustEnv("VERCEL_TOKEN");
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
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  return { res, text, json };
}








