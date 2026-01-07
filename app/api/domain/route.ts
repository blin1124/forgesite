import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function normalizeDomain(input: string) {
  return input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
}

function getSupabaseUserClient(res: NextResponse) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookies().getAll();
      },
      setAll(cookieList) {
        cookieList.forEach((c) => res.cookies.set(c.name, c.value, c.options));
      },
    },
  });
}

function getSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("Missing SUPABASE URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function vercelFetch(path: string, init?: RequestInit) {
  const token = process.env.VERCEL_TOKEN || "";
  if (!token) throw new Error("Missing VERCEL_TOKEN");

  const base = "https://api.vercel.com";
  const res = await fetch(base + path, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  if (!res.ok) {
    const msg = json?.error?.message || json?.message || text.slice(0, 240) || `Vercel error (${res.status})`;
    const err = new Error(msg);
    (err as any).status = res.status;
    (err as any).payload = json;
    throw err;
  }

  return json;
}

function vercelQuery() {
  const teamId = process.env.VERCEL_TEAM_ID || "";
  return teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
}

/**
 * POST:
 *  { domain: string, site_id?: string }
 *  - Adds domain to Vercel project
 *  - Stores row in public.custom_domains (user_id scoped)
 *  - Returns dns instructions (verification challenges from Vercel payload when not verified)
 *
 * GET:
 *  - Lists current user's domains (most recent first)
 *
 * PUT:
 *  { domain: string }
 *  - Attempts to verify domain again
 */
export async function POST(req: NextRequest) {
  const res = NextResponse.next();
  try {
    const projectId = process.env.VERCEL_PROJECT_ID || "";
    if (!projectId) return jsonError("Missing VERCEL_PROJECT_ID", 500);

    const supaUser = getSupabaseUserClient(res);
    const { data: userData, error: userErr } = await supaUser.auth.getUser();
    if (userErr || !userData?.user) return jsonError("Not signed in.", 401);

    const body = await req.json().catch(() => ({}));
    const domainRaw = String(body?.domain || "");
    const site_id = body?.site_id ? String(body.site_id) : null;

    const domain = normalizeDomain(domainRaw);
    if (!domain || !domain.includes(".")) return jsonError("Enter a valid domain (example: yourbusiness.com).", 400);

    // 1) Add domain to Vercel project
    // Known pattern used by Vercel API users: POST /v10/projects/{projectId}/domains :contentReference[oaicite:3]{index=3}
    const added = await vercelFetch(`/v10/projects/${encodeURIComponent(projectId)}/domains${vercelQuery()}`, {
      method: "POST",
      body: JSON.stringify({ name: domain }),
    });

    const vercel_verified = Boolean(added?.verified);

    // 2) Save to DB (service role so we can upsert regardless of RLS edge cases)
    const supaSvc = getSupabaseServiceClient();

    const { data: up, error: upErr } = await supaSvc
      .from("custom_domains")
      .upsert(
        {
          user_id: userData.user.id,
          site_id,
          domain,
          status: vercel_verified ? "verified" : "pending",
          vercel_verified,
          verification: added ?? null,
          last_error: null,
        },
        { onConflict: "domain" }
      )
      .select("*")
      .single();

    if (upErr) return jsonError(`DB error: ${upErr.message}`, 500);

    return NextResponse.json(
      {
        ok: true,
        domain: up.domain,
        status: up.status,
        vercel_verified: up.vercel_verified,
        verification: up.verification,
        dns: extractDnsFromVercelPayload(added),
      },
      { headers: res.headers }
    );
  } catch (err: any) {
    return jsonError(err?.message || "Domain connect failed.", 500);
  }
}

export async function GET() {
  try {
    const res = NextResponse.next();
    const supaUser = getSupabaseUserClient(res);
    const { data: userData } = await supaUser.auth.getUser();
    if (!userData?.user) return jsonError("Not signed in.", 401);

    const supaSvc = getSupabaseServiceClient();
    const { data, error } = await supaSvc
      .from("custom_domains")
      .select("id, domain, status, vercel_verified, verification, last_error, created_at, updated_at, site_id")
      .eq("user_id", userData.user.id)
      .order("created_at", { ascending: false });

    if (error) return jsonError(error.message, 500);

    return NextResponse.json({ domains: data || [] });
  } catch (err: any) {
    return jsonError(err?.message || "List failed.", 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const projectId = process.env.VERCEL_PROJECT_ID || "";
    if (!projectId) return jsonError("Missing VERCEL_PROJECT_ID", 500);

    const res = NextResponse.next();
    const supaUser = getSupabaseUserClient(res);
    const { data: userData } = await supaUser.auth.getUser();
    if (!userData?.user) return jsonError("Not signed in.", 401);

    const body = await req.json().catch(() => ({}));
    const domain = normalizeDomain(String(body?.domain || ""));
    if (!domain) return jsonError("Missing domain", 400);

    // Verify endpoint pattern is commonly documented/used for project domains :contentReference[oaicite:4]{index=4}
    const verifiedPayload = await vercelFetch(
      `/v10/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domain)}/verify${vercelQuery()}`,
      { method: "POST", body: JSON.stringify({}) }
    );

    const vercel_verified = Boolean(verifiedPayload?.verified);

    const supaSvc = getSupabaseServiceClient();
    const { data: up, error: upErr } = await supaSvc
      .from("custom_domains")
      .update({
        status: vercel_verified ? "verified" : "pending",
        vercel_verified,
        verification: verifiedPayload ?? null,
        last_error: null,
      })
      .eq("user_id", userData.user.id)
      .eq("domain", domain)
      .select("*")
      .single();

    if (upErr) return jsonError(`DB error: ${upErr.message}`, 500);

    return NextResponse.json({
      ok: true,
      domain: up.domain,
      status: up.status,
      vercel_verified: up.vercel_verified,
      verification: up.verification,
      dns: extractDnsFromVercelPayload(verifiedPayload),
    });
  } catch (err: any) {
    return jsonError(err?.message || "Verify failed.", 500);
  }
}

/**
 * Best-effort extraction for DNS steps.
 * Vercel payloads differ by account/domain state; we expose what we can.
 */
function extractDnsFromVercelPayload(payload: any) {
  const out: { type: string; name: string; value: string }[] = [];

  // Common places Vercel may return “verification challenges”
  const checks = payload?.verification || payload?.verificationChallenges || payload?.verificationChallenge || null;

  if (Array.isArray(checks)) {
    for (const c of checks) {
      const type = String(c?.type || c?.recordType || "");
      const name = String(c?.domain || c?.name || c?.record || "");
      const value = String(c?.value || c?.target || c?.expectedValue || "");
      if (type && (name || value)) out.push({ type, name, value });
    }
  } else if (checks && typeof checks === "object") {
    const type = String(checks?.type || checks?.recordType || "");
    const name = String(checks?.domain || checks?.name || checks?.record || "");
    const value = String(checks?.value || checks?.target || checks?.expectedValue || "");
    if (type && (name || value)) out.push({ type, name, value });
  }

  // Fallback: show raw hints if present
  if (out.length === 0 && payload?.expectedVerification) {
    out.push({
      type: "TXT",
      name: String(payload.expectedVerification?.name || ""),
      value: String(payload.expectedVerification?.value || ""),
    });
  }

  return out;
}
