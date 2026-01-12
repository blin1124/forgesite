"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type DomainRow = {
  id: string;
  domain: string;
  site_id: string | null;
  status: string | null;
  verified: boolean | null;
  dns_records: any[] | null;
  created_at?: string | null;
};

export default function DomainPage() {
  const router = useRouter();
  const sp = useSearchParams();

  // site id comes from /domain?site=xxxxx
  const siteId = sp.get("site") || "";

  const [domain, setDomain] = useState<string>("");
  const [rows, setRows] = useState<DomainRow[]>([]);
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState<string>("");

  async function loadDomains() {
    setError("");
    try {
      const res = await fetch("/api/domain/list", { method: "GET" });
      const text = await res.text();
      let json: any = {};
      try {
        json = JSON.parse(text);
      } catch {
        json = {};
      }
      if (!res.ok) throw new Error(json?.error || `List failed (${res.status})`);
      setRows(Array.isArray(json?.domains) ? json.domains : []);
    } catch (e: any) {
      setError(e?.message || "Failed to load domains");
      setRows([]);
    }
  }

  async function connectDomain() {
    setBusy("Connecting…");
    setError("");
    try {
      const d = domain.trim().toLowerCase();
      if (!d) throw new Error("Enter a domain.");
      if (!siteId) throw new Error("Missing site id. Open from Builder using Connect Domain.");

      const res = await fetch("/api/domain/connect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain: d, site_id: siteId }),
      });

      const text = await res.text();
      let json: any = {};
      try {
        json = JSON.parse(text);
      } catch {
        json = {};
      }

      if (!res.ok) throw new Error(json?.error || `Connect failed (${res.status}): ${text.slice(0, 160)}`);

      setDomain("");
      await loadDomains();
    } catch (e: any) {
      setError(e?.message || "Connect failed");
    } finally {
      setBusy("");
    }
  }

  async function verifyDomain(d: string) {
    setBusy("Verifying…");
    setError("");
    try {
      const res = await fetch("/api/domain/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain: d }),
      });

      const text = await res.text();
      let json: any = {};
      try {
        json = JSON.parse(text);
      } catch {
        json = {};
      }

      if (!res.ok) throw new Error(json?.error || `Verify failed (${res.status}): ${text.slice(0, 160)}`);

      await loadDomains();
    } catch (e: any) {
      setError(e?.message || "Verify failed");
    } finally {
      setBusy("");
    }
  }

  useEffect(() => {
    loadDomains();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main style={page}>
      <div style={shell}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900 }}>Connect Domain</h1>
            <div style={{ marginTop: 6, opacity: 0.85 }}>
              Attach a customer domain to site: <b>{siteId || "(missing site id)"}</b>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button style={secondaryBtn} onClick={() => router.push("/builder")}>
              Back to Builder
            </button>
            <button style={secondaryBtn} onClick={loadDomains}>
              Refresh
            </button>
          </div>
        </div>

        {error ? <div style={errorBox}>{error}</div> : null}
        {busy ? <div style={{ marginTop: 12, opacity: 0.95 }}>{busy}</div> : null}

        <section style={{ ...card, marginTop: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 900 }}>Add a domain</div>
          <div style={{ opacity: 0.85, fontSize: 13, marginTop: 6 }}>
            Enter a root domain like <b>example.com</b>. (No http/https, no paths.)
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
            <input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="example.com"
              style={{ ...input, flex: 1, minWidth: 240 }}
            />
            <button style={primaryBtn} onClick={connectDomain} disabled={!siteId || !domain.trim()}>
              Connect
            </button>
          </div>
        </section>

        <section style={{ ...card, marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900 }}>Your domains</div>
              <div style={{ opacity: 0.85, fontSize: 13, marginTop: 6 }}>{rows.length} record(s)</div>
            </div>
          </div>

          {rows.length === 0 ? (
            <div style={{ marginTop: 12, opacity: 0.85 }}>No domains yet.</div>
          ) : (
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {rows.map((r) => (
                <div key={r.id} style={domainCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: 16 }}>{r.domain}</div>
                      <div style={{ opacity: 0.85, fontSize: 13, marginTop: 4 }}>
                        status: <b>{r.status || "unknown"}</b> • verified: <b>{String(!!r.verified)}</b> • site:{" "}
                        <b>{r.site_id || "—"}</b>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <button style={secondaryBtn} onClick={() => verifyDomain(r.domain)}>
                        Verify
                      </button>
                    </div>
                  </div>

                  {Array.isArray(r.dns_records) && r.dns_records.length > 0 ? (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontWeight: 900, fontSize: 13, opacity: 0.95 }}>DNS records required:</div>
                      <pre style={pre}>
                        {JSON.stringify(r.dns_records, null, 2)}
                      </pre>
                    </div>
                  ) : (
                    <div style={{ marginTop: 10, opacity: 0.85, fontSize: 13 }}>
                      DNS records will appear after you connect.
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  padding: 18,
  color: "white",
  background:
    "radial-gradient(1200px 600px at 20% 0%, rgba(255,255,255,0.18), transparent 60%), linear-gradient(135deg, rgb(124,58,237) 0%, rgb(109,40,217) 35%, rgb(91,33,182) 100%)",
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
};

const shell: React.CSSProperties = {
  width: "min(980px, 95vw)",
  margin: "0 auto",
  background: "rgba(255,255,255,0.10)",
  border: "1px solid rgba(255,255,255,0.18)",
  borderRadius: 18,
  padding: 16,
  boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
};

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.10)",
  border: "1px solid rgba(255,255,255,0.18)",
  borderRadius: 16,
  padding: 14,
};

const input: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "rgba(255,255,255,0.14)",
  color: "white",
  outline: "none",
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

const errorBox: React.CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 12,
  background: "rgba(185, 28, 28, .25)",
  border: "1px solid rgba(185, 28, 28, .5)",
  whiteSpace: "pre-wrap",
};

const domainCard: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(0,0,0,0.18)",
};

const pre: React.CSSProperties = {
  marginTop: 8,
  padding: 10,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(0,0,0,0.25)",
  overflow: "auto",
  fontSize: 12,
  lineHeight: 1.35,
};





