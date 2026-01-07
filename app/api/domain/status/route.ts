import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function cleanDomain(d: string) {
  return String(d || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\s+/g, "");
}

function getSupabaseAuthClient(req: NextRequest, res: NextResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );
}

async function vercelFetch(path: string, init?: RequestInit) {
  const token = process.env.VERCEL_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID;

  if (!token) throw new Error("Missing VERCEL_TOKEN");
  const url = new URL(`https://api.vercel.com${path}`);
  if (teamId) url.searchParams.set("teamId", teamId);

  const resp = await fetch(url.toString(), {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  const text = await resp.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  return { ok: resp.ok, status: resp.status, text, json };
}

export async function POST(req: NextRequest) {
  const res = NextResponse.next();

  try {
    const body = await req.json().catch(() => ({}));
    const domain = cleanDomain(String(body?.domain || ""));
    if (!domain) return jsonError("Missing domain", 400);

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) return jsonError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY", 500);

    const authClient = getSupabaseAuthClient(req, res);
    const { data: userData } = await authClient.auth.getUser();
    const user = userData?.user;
    if (!user) return jsonError("Not signed in.", 401);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const projectId = process.env.VERCEL_PROJECT_ID;
    if (!projectId) return jsonError("Missing VERCEL_PROJECT_ID", 500);

    const info = await vercelFetch(`/v9/projects/${projectId}/domains/${encodeURIComponent(domain)}`, {
      method: "GET",
    });

    if (!info.ok) {
      await admin
        .from("custom_domains")
        .update({
          status: "error",
          verification: { step: "status_check", vercel: info.json || { raw: info.text } },
        })
        .eq("domain", domain)
        .eq("user_id", user.id);

      return jsonError(
        info.json?.error?.message || info.json?.message || `Vercel status failed (${info.status})`,
        500
      );
    }

    const vercelPayload = info.json;

    const verified =
      Boolean(vercelPayload?.verified) ||
      vercelPayload?.verification?.status === "verified" ||
      vercelPayload?.verification?.verified === true;

    const status = verified ? "verified" : "pending";

    const { data: row, error: upErr } = await admin
      .from("custom_domains")
      .update({
        status,
        verification: { vercel: vercelPayload },
      })
      .eq("domain", domain)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (upErr) return jsonError(`DB update failed: ${upErr.message}`, 500);

    return NextResponse.json(
      {
        domain: row.domain,
        status: row.status,
        verification: row.verification,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("DOMAIN_STATUS_ERROR:", err);
    return jsonError(err?.message || "Domain status crashed", 500);
  }
}
