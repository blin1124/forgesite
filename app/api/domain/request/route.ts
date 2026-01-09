import { NextResponse } from "next/server";
import { getUserIdFromAuthHeader, normalizeDomain, supabaseAdmin, vercelFetch, mustEnv } from "../_lib";

export const runtime = "nodejs";

function pickDnsRecords(vercelJson: any) {
  // Vercel responses vary by domain state.
  // We store whatever looks like verification/dns instructions.
  const out: any[] = [];

  // common: verification array with {type, domain, value, reason}
  if (Array.isArray(vercelJson?.verification)) {
    for (const v of vercelJson.verification) out.push(v);
  }

  // sometimes "verified" is boolean and challenges are elsewhere
  if (Array.isArray(vercelJson?.challenges)) {
    for (const c of vercelJson.challenges) out.push(c);
  }

  // some endpoints return "dnsRecords"
  if (Array.isArray(vercelJson?.dnsRecords)) {
    for (const r of vercelJson.dnsRecords) out.push(r);
  }

  return out.length ? out : null;
}

export async function POST(req: Request) {
  try {
    const admin = supabaseAdmin();
    const user_id = await getUserIdFromAuthHeader(admin, req);
    if (!user_id) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const raw = String(body?.domain || "");
    const domain = normalizeDomain(raw);

    if (!domain || domain.length < 3 || !domain.includes(".")) {
      return NextResponse.json({ error: "Enter a valid domain (example: yourbusiness.com)" }, { status: 400 });
    }

    const projectId = mustEnv("VERCEL_PROJECT_ID");

    // 1) Upsert in DB as pending first (so UI can show it even if Vercel fails)
    const { data: upData, error: upErr } = await admin
      .from("custom_domains")
      .upsert(
        {
          user_id,
          domain,
          status: "pending",
          verified: false,
          last_error: null,
        },
        { onConflict: "user_id,domain" }
      )
      .select("id, domain")
      .single();

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    const id = upData.id;

    // 2) Provision domain in Vercel (project domains)
    // POST /v10/projects/{projectId}/domains { name }
    const prov = await vercelFetch(`/v10/projects/${projectId}/domains`, {
      method: "POST",
      body: JSON.stringify({ name: domain }),
    });

    if (!prov.ok) {
      // store error
      await admin
        .from("custom_domains")
        .update({ status: "error", last_error: prov.json?.error?.message || prov.text || `Vercel error (${prov.status})` })
        .eq("id", id);

      return NextResponse.json(
        { error: prov.json?.error?.message || `Vercel provision failed (${prov.status})`, details: prov.json || prov.text },
        { status: 500 }
      );
    }

    // 3) Read back domain status (GET) to retrieve verification details when available
    const info = await vercelFetch(`/v10/projects/${projectId}/domains/${encodeURIComponent(domain)}`, {
      method: "GET",
    });

    const verification = info.ok ? info.json : prov.json;
    const dns_records = pickDnsRecords(verification);

    const isVerified =
      Boolean(verification?.verified) === true ||
      String(verification?.verification?.[0]?.status || "").toLowerCase() === "succeeded";

    await admin
      .from("custom_domains")
      .update({
        verification,
        dns_records,
        verified: isVerified,
        status: isVerified ? "verified" : "pending",
        last_error: null,
      })
      .eq("id", id);

    return NextResponse.json({
      id,
      domain,
      verified: isVerified,
      dns_records,
      verification,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Request failed" }, { status: 500 });
  }
}

