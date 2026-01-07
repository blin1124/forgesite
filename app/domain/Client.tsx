"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type DomainRow = {
  id: string;
  domain: string;
  status: string;
  site_id: string | null;
  created_at: string;
  updated_at: string;
  verification: any;
};

async function readResponse(res: Response) {
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { text, json };
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

/**
 * Best-effort extraction of DNS records from Vercel responses.
 * Vercel shapes can vary; this tries common places.
 */
function extractDnsRecords(verification: any): { type: string; name: string; value: string }[] {
  const v = verification?.vercel || verification || {};

  // Common: v.verification / v.config / v.misconfigured / v.recommended etc.
  const candidates: any[] = [];

  // Try common arrays:
  if (Array.isArray(v?.verification?.dnsRecords)) candidates.push(...v.verification.dnsRecords);
  if (Array.isArray(v?.verification?.records)) candidates.push(...v.verification.records);
  if (Array.isArray(v?.dnsRecords)) candidates.push(...v.dnsRecords);
  if (Array.isArray(v?.records)) candidates.push(...v.records);

  // Try nested "verification" objects:
  if (Array.isArray(v?.verification)) candidates.push(...v.verification);

  // Normalize possible record shapes:
  const out: { type: string; name: string; value: string }[] = [];
  for (const r of candidates) {
    const type = String(r?.type || r?.recordType || r?.kind || "").toUpperCase();
    const name = String(r?.name || r?.host || r?.domain || r?.subdomain || "");
    const value = String(r?.value || r?.target || r?.data || r?.pointsTo || "");
    if (type && (name || value)) out.push({ type, name, value });
  }

  return dedupeRecords(out);
}

function dedupeRecords(records: { type: string; name: string; value: string }[]) {
  const seen = new Set<string>();
  const out: { type: string; name: string; value: string }[] = [];
  for (const r of records) {
    const k = `${r.type}::${r.name}::${r.value}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

export default function DomainClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const site_id = sp.get("site_id") || null;

  const [email, setEmail] = useState("");

  const [domainInput, setDomainInput] = useState("");
  const domainClean = useMemo(() => cleanDomain(domainInput), [domainInput]);

  const [rows, setRows] = useState<DomainRow[]>([]);
  const [active, setActive] = useState<DomainRow | null>(null);

  const [busy, setBusy] = useState("");
  const [debug, setDebug] = useState("");

  useEffect(() => {
    const run = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();
        setEmail(data?.session?.user?.email || "");
      } catch {
        setEmail("");
      }

      await refresh();
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-poll while pending
  useEffect(() => {
    if (!active?.domain) return;
    if (active.status !== "pending") return;

    const t = setInterval(() => {
      verify(active.domain);
    }, 10000);

    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.domain, active?.status]);

  async function refresh() {
    try {
      const res = await fetch("/api/domain/list");
      const { text, json } = await readResponse(res);
      if (!res.ok) throw new Error(json?.error || `List failed (${res.status}): ${text.slice(0, 200)}`);

      const list = Array.isArray(json?.domains) ? json.domains : [];
      setRows(list);

      // keep active row in sync
      if (active?.id) {
        const found = list.find((x: DomainRow) => x.id === active.id) || null;
        setActive(found);
      } else {
        setActive(list[0] || null);
      }
    } catch (e: any) {
      setDebug(e?.message || "Failed to load domains");
    }
  }

  async function requestDns() {
    setBusy("");
    setDebug("");

    const d = domainClean;

    if (!isValidDomain(d)) return setBusy("Enter a valid domain like: yourbusiness.com");

    try {
      setBusy("Creating domain + fetching DNS records…");

      const res = await fetch("/api/domain/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain: d, site_id }),
      });

      const { text, json } = await readResponse(res);
      if (!res.ok) throw new Error(json?.error || `Request failed (${res.status}): ${text.slice(0, 240)}`);

      await refresh();

      // set active to the domain just requested
      const found = (Array.isArray(json?.domain) ? null : null); // no-op; refresh handles
      setBusy("Saved ✅ Now add the DNS records below.");
      setTimeout(() => setBusy(""), 1600);

      // clear field after request
      setDomainInput("");
    } catch (e: any) {
      setBusy(e?.message || "Domain request failed");
      setDebug(String(e?.stack || ""));
    }
  }

  async function verify(domain: string) {
    setBusy("");
    setDebug("");

    try {
      setBusy("Verifying…");

      const res = await fetch("/api/domain/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain }),
      });

      const { text, json } = await readResponse(res);
      if (!res.ok) throw new Error(json?.error || `Verify failed (${res.status}): ${text.slice(0, 240)}`);

      await refresh();

      setBusy("");
    } catch (e: any) {
      setBusy(e?.message || "Verify failed");
      setDebug(String(e?.stack || ""));
    }
  }

  const records = extractDnsRecords(active?.verification);
  const statusLabel = active?.status || "—";

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 16,
        color: "white",
        background:
          "radial-gradient(1200px 600px at 20% 0%, rgba(255,255,255,0.18), transparent 60%), linear-gradient(135deg, rgb(124,58,237) 0%, rgb(109,40,217) 35%, rgb(91,33,182) 100%)",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
      }}
    >
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontSize: 40, fontWeight: 900, lineHeight: 1 }}>Domain</div>
          <div style={{ opacity: 0.9 }}>
            Signed in as <b>{email || "unknown"}</b>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button style={topBtn} onClick={() => router.push(site_id ? `/builder?site_id=${encodeURIComponent(site_id)}` : "/builder")}>
            ← Back to Builder
          </button>
          <button style={topBtn} onClick={() => router.push("/billing")}>
            Billing
          </button>
        </div>
      </header>

      <div style={{ marginTop: 14, maxWidth: 1100, display: "grid", gridTemplateColumns: "360px 1fr", gap: 14 }}>
        {/* LEFT: domains list */}
        <section style={card}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>Your domains</div>
          <div style={{ opacity: 0.85, fontSize: 13, marginTop: 6 }}>{rows.length} domain(s)</div>

          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {rows.map((r) => (
              <button
                key={r.id}
                onClick={() => setActive(r)}
                style={{
                  ...listBtn,
                  borderColor: active?.id === r.id ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.18)",
                }}
              >
                <div style={{ fontWeight: 900 }}>{r.domain}</div>
                <div style={{ opacity: 0.9, fontSize: 12 }}>
                  {r.status} • {new Date(r.created_at).toLocaleString()}
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* RIGHT: connect flow */}
        <section style={card}>
          <div style={{ fontSize: 22, fontWeight: 900 }}>Connect your custom domain</div>
          <div style={{ opacity: 0.92, marginTop: 6, lineHeight: 1.4 }}>
            Enter a domain you own (like <b>yourbusiness.com</b>). We’ll show you the exact DNS records to add in GoDaddy,
            IONOS, Namecheap, etc.
          </div>

          <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              placeholder="yourbusiness.com"
              style={{ ...input, minWidth: 340, flex: 1 }}
            />
            <button style={primaryBtn} onClick={requestDns}>
              Get DNS records
            </button>
          </div>

          {busy ? (
            <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: "rgba(0,0,0,0.25)" }}>{busy}</div>
          ) : null}

          {debug ? (
            <div
              style={{
                marginTop: 10,
                padding: 10,
                borderRadius: 12,
                background: "rgba(185, 28, 28, .25)",
                border: "1px solid rgba(185, 28, 28, .5)",
              }}
            >
              <div style={{ fontWeight: 900 }}>Debug</div>
              <div style={{ whiteSpace: "pre-wrap", fontSize: 12, opacity: 0.95 }}>{debug}</div>
            </div>
          ) : null}

          <div style={{ marginTop: 18, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 900 }}>Status</div>
              <div style={{ opacity: 0.92 }}>
                {active?.domain ? (
                  <>
                    <b>{active.domain}</b> — <span style={badge(active.status)}>{statusLabel}</span>
                  </>
                ) : (
                  "No domain selected yet."
                )}
              </div>
            </div>

            {active?.domain ? (
              <button style={secondaryBtn} onClick={() => verify(active.domain)}>
                Verify now →
              </button>
            ) : null}
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 900 }}>DNS records to add</div>
            <div style={{ opacity: 0.9, fontSize: 13, marginTop: 6, lineHeight: 1.4 }}>
              Add these records in your domain registrar’s DNS settings. After saving, click “Verify now”.
            </div>

            <div style={{ marginTop: 10, borderRadius: 14, overflow: "hidden", border: "1px solid rgba(255,255,255,0.18)" }}>
              {active?.domain ? (
                records.length ? (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "rgba(0,0,0,0.18)" }}>
                        <th style={th}>Type</th>
                        <th style={th}>Name / Host</th>
                        <th style={th}>Value / Target</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((r, idx) => (
                        <tr key={idx} style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}>
                          <td style={td}>{r.type}</td>
                          <td style={{ ...td, wordBreak: "break-word" }}>{r.name || "@"}</td>
                          <td style={{ ...td, wordBreak: "break-all" }}>
                            {r.value || process.env.NEXT_PUBLIC_VERCEL_URL || process.env.NEXT_PUBLIC_SITE_URL || ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ padding: 12, opacity: 0.92 }}>
                    We saved your domain, but didn’t receive clear DNS records from the provider response.
                    That’s OK — click “Verify now” after pointing your domain to ForgeSite.
                    <div style={{ marginTop: 8, opacity: 0.85, fontSize: 13 }}>
                      (We’ll tighten this once your Vercel response shape is confirmed in logs.)
                    </div>
                  </div>
                )
              ) : (
                <div style={{ padding: 12, opacity: 0.92 }}>
                  Enter a domain and click <b>Get DNS records</b>.
                </div>
              )}
            </div>
          </div>

          <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href="https://www.godaddy.com/domains" target="_blank" rel="noreferrer" style={linkBtn}>
              Buy on GoDaddy →
            </a>
            <a href="https://www.ionos.com/domains" target="_blank" rel="noreferrer" style={linkBtn}>
              Buy on IONOS →
            </a>
            <a href="https://www.namecheap.com/domains/" target="_blank" rel="noreferrer" style={linkBtn}>
              Buy on Namecheap →
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.12)",
  border: "1px solid rgba(255,255,255,0.18)",
  borderRadius: 16,
  padding: 16,
  boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
};

const input: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "rgba(255,255,255,0.14)",
  color: "white",
  outline: "none",
};

const topBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "rgba(255,255,255,0.14)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const primaryBtn: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.92)",
  color: "rgb(85, 40, 150)",
  fontWeight: 900,
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "rgba(255,255,255,0.14)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const linkBtn: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "rgba(255,255,255,0.14)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const listBtn: React.CSSProperties = {
  textAlign: "left",
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.10)",
  color: "white",
  cursor: "pointer",
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: 13,
  fontWeight: 900,
  color: "white",
};

const td: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 13,
  color: "white",
  opacity: 0.95,
};

function badge(status?: string) {
  const s = String(status || "").toLowerCase();
  if (s === "verified") return { background: "rgba(34,197,94,.25)", border: "1px solid rgba(34,197,94,.45)" };
  if (s === "error") return { background: "rgba(239,68,68,.25)", border: "1px solid rgba(239,68,68,.45)" };
  return { background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.18)" };
}






