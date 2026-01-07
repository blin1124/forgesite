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

function isValidDomain(d: string) {
  if (!d || d.length > 253) return false;
  if (d.includes("/") || d.includes(" ")) return false;
  if (!/^[a-z0-9.-]+\.[a-z0-9-]+$/i.test(d)) return false;
  if (/^[.-]|[.-]$/.test(d)) return false;
  return true;
}

async function getUserId() {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookies().getAll(),
        setAll: () => {},
      },
    }
  );

  const { data } = await supabase.auth.getUser();
  if (!data?.user?.id) throw new Error("Not authenticated");
  return data.user.id;
}

async function addDomainToVercel(domain: string) {
  const token = process.env.VERCEL_TOKEN!;
  const projectId = process.env.VERCEL_PROJECT_ID!;

  const res = await fetch(
    `https://api.vercel.com/v10/projects/${projectId}/domains`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: domain }),
    }
  );

  const text = await res.text();
  const json = JSON.parse(text);

  if (!res.ok) {
    throw new Error(json?.error?.message || "Vercel domain add failed");
  }

  return json;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawDomain = String(body.domain || "");

    const domain = normalizeDomain(rawDomain);
    if (!isValidDomain(domain)) {
      return jsonError("Invalid domain name");
    }

    const user_id = await getUserId();

    const admin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // Save immediately
    await admin.from("custom_domains").upsert({
      user_id,
      domain,
      status: "pending",
      updated_at: new Date().toISOString(),
    });

    // Add to Vercel
    const vercelPayload = await addDomainToVercel(domain);

    // Update status
    await admin.from("custom_domains").update({
      status: "added",
      vercel_payload: vercelPayload,
      updated_at: new Date().toISOString(),
    }).eq("user_id", user_id).eq("domain", domain);

    return NextResponse.json({
      ok: true,
      domain,
      status: "added",
    });
  } catch (err: any) {
    return jsonError(err.message || "Domain connect failed", 500);
  }
}


