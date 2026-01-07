import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function normalizeDomain(input: string) {
  return input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
}

// very simple “good enough” validator (no protocols, no paths)
function isValidDomain(d: string) {
  if (!d || d.length > 253) return false;
  if (d.includes("/") || d.includes(" ")) return false;
  // must contain at least one dot and end with a letter/number
  if (!/^[a-z0-9.-]+\.[a-z0-9-]+$/i.test(d)) return false;
  // no leading/trailing dot or dash
  if (/^[.-]|[.-]$/.test(d)) return false;
  return true;
}

async function getAuthedUserId() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!url || !anon) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");

  const cookieStore = cookies();

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // no-op in route handler response; we only need reads here
      },
    },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(error.message);
  const uid = data?.user?.id;
  if (!uid) throw new Error("Not signed in");
  return uid;
}

async function upsertDomainRow(args: {
  user_id: string;
  domain: string;
  site_id?: string | null;
  status?: string | null;
  vercel_payload?: any;
}) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !serviceKey) throw new Error("Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY");

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Table name below assumes you created: public.custom_domains
  // If yours is different, change it here.
  const { error } = await admin.from("custom_domains").upsert(
    {
      user_id: args.user_id,
      domain: args.domain,
      site_id: args.site_id ?? null,
      status: args.status ?? "pending",
      vercel_payload: args.vercel_payload ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,domain" }
  );

  if (error) throw new Error(error.message);
}

async function vercelAddDomain(domain: string) {
  const token = process.env.VERCEL_TOKEN || "";
  const projectId = process.env.VERCEL_PROJECT_ID || "";
  if (!token) throw new Error("Missing VERCEL_TOKEN");
  if (!projectId) throw new Error("Missing VERCEL_PROJECT_ID");

  // Add domain to project
  const addRes = await fetch(`https://api.vercel.com/v10/projects/${projectId}/domains`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: domain }),
  });

  const addText = await addRes.text();
  let addJson: any = {};
  try {
    addJson = JSON.parse(addText);
  } catch {
    addJson = { raw: addText };
  }

  if (!addRes.ok) {
    throw new Error(addJson?.error?.message || addJson?.message || `Vercel add-domain failed (${addRes.status})`);
  }

  // Fetch domain status (includes verification info if any)
  const getRes = await fetch(`https://api.vercel.com/v10/projects/${projectId}/domains/${encodeURIComponent(domain)}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  const getText = await getRes.text();
  let getJson: any = {};
  try {
    getJson = JSON.parse(getText);
  } catch {
    getJson = { raw: getText };
  }

  // It’s okay if this fails; add-domain succeeded, we just may not have verification data yet
  return { add: addJson, details: getRes.ok ? getJson : null };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const rawDomain = String(body?.domain || "");
    const site_id = body?.site_id ? String(body.site_id) : null;

    const domain = normalizeDomain(rawDomain);

    if (!isValidDomain(domain)) {
      return jsonError("Invalid domain. Example: yourbusiness.com", 400);
    }

    const user_id = await getAuthedUserId();

    // 1) Save as pending immediately (so UI can show it even if Vercel call is slow)
    await upsertDomainRow({ user_id, domain, site_id, status: "pending" });

    // 2) Add to Vercel project + fetch verification/status
    const payload = await vercelAddDomain(domain);

    // 3) Store Vercel response for later “DNS records / verify” step
    await upsertDomainRow({
      user_id,
      domain,
      site_id,
      status: "added",
      vercel_payload: payload,
    });

    return NextResponse.json({
      ok: true,
      domain,
      status: "added",
      vercel: payload,
    });
  } catch (err: any) {
    return jsonError(err?.message || "Domain connect failed", 500);
  }
}
