import React from "react";
import { headers } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * This page is meant to serve customer sites from subdomains:
 *   whatever.forgesite.net  -> sub = "whatever"
 *
 * It looks up the subdomain mapping and then renders that site's HTML.
 *
 * Assumes tables:
 * - custom_domains OR subdomains table (we’ll use custom_domains with type/target if present)
 * - sites table with html column
 *
 * If your schema differs, paste your columns and I’ll align it.
 */
export default async function HostedSubdomainPage({
  params,
}: {
  params: { sub: string };
}) {
  const supabaseAdmin = getSupabaseAdmin();

  const sub = String(params?.sub || "").toLowerCase().trim();

  // host header helps confirm environment; not required
  const h = headers();
  const host = (h.get("x-forwarded-host") || h.get("host") || "").toLowerCase();

  if (!sub) {
    return (
      <main style={page}>
        <div style={card}>
          <h1 style={h1}>Missing subdomain</h1>
          <p style={p}>No subdomain provided.</p>
        </div>
      </main>
    );
  }

  /**
   * Strategy:
   * 1) Find a mapping record for this subdomain.
   *    - If you store as "whatever.forgesite.net" in custom_domains.domain, build it
   *    - If you store just "whatever" somewhere, you can adjust easily
   */
  const fullDomainGuess = host.includes(".") ? host : `${sub}.forgesite.net`;

  // Try to find by full host first, then by subdomain field if you have one
  let siteId: string | null = null;

  // A) Try custom_domains.domain === host/full guess
  const { data: dom1 } = await supabaseAdmin
    .from("custom_domains")
    .select("site_id, domain, status, verified, target")
    .in("domain", [host, fullDomainGuess])
    .maybeSingle();

  if (dom1?.site_id) {
    siteId = String(dom1.site_id);
  } else {
    // B) Optional: if you have a dedicated subdomains table
    const { data: subRow } = await supabaseAdmin
      .from("subdomains")
      .select("site_id, sub")
      .eq("sub", sub)
      .maybeSingle();

    if (subRow?.site_id) siteId = String(subRow.site_id);
  }

  if (!siteId) {
    return (
      <main style={page}>
        <div style={card}>
          <h1 style={h1}>Site not found</h1>
          <p style={p}>
            No site mapping found for subdomain: <b>{sub}</b>
          </p>
          <p style={{ ...p, opacity: 0.75 }}>
            Host header: <b>{host || "(none)"}</b>
          </p>
        </div>
      </main>
    );
  }

  // 2) Fetch site html
  const { data: site, error: siteErr } = await supabaseAdmin
    .from("sites")
    .select("id, html")
    .eq("id", siteId)
    .maybeSingle();

  if (siteErr) {
    return (
      <main style={page}>
        <div style={card}>
          <h1 style={h1}>Error loading site</h1>
          <pre style={pre}>{siteErr.message}</pre>
        </div>
      </main>
    );
  }

  const html = String((site as any)?.html || "").trim();

  if (!html) {
    return (
      <main style={page}>
        <div style={card}>
          <h1 style={h1}>Site has no HTML yet</h1>
          <p style={p}>Site ID: <b>{siteId}</b></p>
        </div>
      </main>
    );
  }

  // Render the site HTML
  return (
    <main style={{ minHeight: "100vh" }}>
      <iframe
        title={`site-${siteId}`}
        style={{ width: "100%", height: "100vh", border: 0 }}
        sandbox="allow-same-origin"
        srcDoc={html}
      />
    </main>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  padding: 24,
  background: "#0b0b0f",
  color: "white",
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
};

const card: React.CSSProperties = {
  maxWidth: 900,
  margin: "0 auto",
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  borderRadius: 16,
  padding: 16,
};

const h1: React.CSSProperties = { margin: 0, fontSize: 26, fontWeight: 900 };
const p: React.CSSProperties = { marginTop: 10, opacity: 0.9 };
const pre: React.CSSProperties = {
  marginTop: 10,
  padding: 12,
  borderRadius: 12,
  background: "rgba(0,0,0,0.35)",
  border: "1px solid rgba(255,255,255,0.10)",
  whiteSpace: "pre-wrap",
};

