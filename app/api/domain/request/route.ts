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

function isValidDomain(d: string) {
  if (!d) return false;
  if (d.includes("/")) return false;
  if (d.includes(" ")) return false;
  if (!d.includes(".")) return false;
  return /^[a-z0-9.-]+$/.test(d);
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
    const domainRaw = String(body?.domain || "");
    const site_id = body?.site_id ? String(body.site_id) : null;

    const domain = cleanDomain(domainRaw);

    if (!isValidDomain(domain)) return jsonError("Enter a valid domain like: yourbusiness.com", 400);

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) return jsonError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY", 500);

    // auth user from cookies
    const authClient = getSupabaseAuthClient(req, res);
    const { data: userData } = await authClient.auth.getUser();
    const user = userData?.user;
    if (!user) return jsonError("Not signed in.", 401);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const projectId = process.env.VERCEL_PROJECT_ID;
    if (!projectId) return jsonError("Missing VERCEL_PROJECT_ID", 500);

    // 1) Add domain to Vercel project
    // POST /v9/projects/:projectId/domains  body: { name: "example.com" }
    const add = await vercelFetch(`/v9/projects/${projectId}/domains`, {
      method: "POST",
      body: JSON.stringify({ name: domain }),
    });

    // Vercel might return 409 if already exists; treat that as OK and fetch status.
    let vercelPayload: any = add.json || { raw: add.text };

    if (!add.ok && add.status !== 409) {
      // store error state
      await admin.from("custom_domains").upsert(
        {
          user_id: user.id,
          site_id,
          domain,
          status: "error",
          verification: { step: "add_domain", vercel: vercelPayload },
        },
        { onConflict: "domain" }
      );

      return jsonError(
        vercelPayload?.error?.message || vercelPayload?.message || `Vercel add domain failed (${add.status})`,
        500
      );
    }

    // 2) Fetch domain details for records/verification
    const info = await vercelFetch(`/v9/projects/${projectId}/domains/${encodeURIComponent(domain)}`, {
      method: "GET",
    });

    if (info.ok) vercelPayload = info.json;
    else vercelPayload = vercelPayload; // fallback to add payload

    // Determine status best-effort
    const verified =
      Boolean(vercelPayload?.verified) ||
      vercelPayload?.verification?.status === "verified" ||
      vercelPayload?.verification?.verified === true;

    const status = verified ? "verified" : "pending";

    // 3) Upsert DB row
    const { data: row, error: upErr } = await admin
      .from("custom_domains")
      .upsert(
        {
          user_id: user.id,
          site_id,
          domain,
          status,
          verification: { vercel: vercelPayload },
        },
        { onConflict: "domain" }
      )
      .select("*")
      .single();

    if (upErr) return jsonError(`DB upsert failed: ${upErr.message}`, 500);

    return NextResponse.json(
      {
        domain: row.domain,
        status: row.status,
        verification: row.verification,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("DOMAIN_REQUEST_ERROR:", err);
    return jsonError(err?.message || "Domain request crashed", 500);
  }
}
