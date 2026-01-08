"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type DomainRow = {
  id: string;
  domain: string;
  status: string;
  created_at: string;
  updated_at: string;
  error_message: string | null;
  vercel_payload: any | null;
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

function normalizeDomain(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
}

export default function Client() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [domain, setDomain] = useState("");

  const [busy, setBusy] = useState("");
  const [debug, setDebug] = useState("");

  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [selected, setSelected] = useState<DomainRow | null>(null);

  const [dnsRecordsText, setDnsRecordsText] = useState(
    "Enter a domain and click Get DNS records."
  );

  const canSubmit = useMemo(() => normalizeDomain(domain).length > 3, [domain]);

  useEffect(() => {
    const run = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();
        setEmail(data?.session?.user?.email || "");
      } catch {
        setEmail("");
      }
      await refreshDomains();
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshDomains() {
    setDebug("");
    try {
      const res = await fetch("/api/domain/list", { method: "GET" });
      const { text, json } = await readResponse(res);

      if (!res.ok) {
        throw new Error(json?.error || `List failed (${res.status}): ${text.slice(0, 240)}`);
      }

      const rows = Array.isArray(json?.domains) ? (json.domains as DomainRow[]) : [];
      setDomains(rows);

      if (selected) {
        const match = rows.find((r) => r.id === selected.id) || null;
        setSelected(match);
        if (match) hydrateDnsBox(match);
      }
    } catch (e: any) {
      setDebug(e?.message || "Failed to list domains");
    }
  }

  function hydrateDnsBox(row: DomainRow) {
    if (row.status === "verified") {
      setDnsRecordsText("✅ Your domain is verified.");
      return;
    }

    if (row.status === "error") {
      setDnsRecordsText(row.error_message || "There was an error with this domain.");
      return;
    }

    if (row.vercel_payload) {
      setDnsRecordsText(
        "DNS records / verification details:\n\n" +
          JSON.stringify(row.vercel_payload, null, 2)
      );
    } else {
      setDnsRecordsText(
        "No DNS records to show yet (your domain may already be verified, or verification is still processing)."
      );
    }
  }

  function pickDomain(row: DomainRow) {
    setSelected(row);
    setBusy("");
    setDebug("");
    hydrateDnsBox(row);
  }

  async function connectDomain() {
    setBusy("");
    setDebug("");

    const d = normalizeDomain(domain);
    if (!d) return setBusy("Enter a domain.");

    try {
      setBusy("Getting DNS records…");

      const res = await fetch("/api/domain/connect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain: d }),
      });

      const { text, json } = await readResponse(res);

      if (!res.ok) {
        // If you ever see HTML here, you're hitting a PAGE route, not the API route.
        throw new Error(json?.error || `Connect failed (${res.status}): ${text.slice(0, 240)}`);
      }

      const returnedRow = (json?.domain_row || null) as DomainRow | null;

      await refreshDomains();

      if (returnedRow?.id) {
        setSelected(returnedRow);
        hydrateDnsBox(returnedRow);
      } else {
        // fallback pick by domain
        const match = domains.find((r) => r.domain === d) || null;
        if (match) {
          setSelected(match);
          hydrateDnsBox(match);
        }
      }

      setBusy("Saved ✅");
      setTimeout(() => setBusy(""), 1200);
    } catch (e: any) {
      setBusy(e?.message || "Connect failed");
      setDebug(String(e?.stack || ""));
    }
  }

  return (
    <main style={page}>
      <header style={header}>
        <div>
          <div style={{ fontSize: 44, fontWeight: 900, lineHeight: 1 }}>Domain</div>
          <div style={{ opacity: 0.9 }}>
            Signed in as <b>{email || "unknown"}</b>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button style={topBtn} onClick={() => router.push("/builder")}>
            ← Back to Builder
          </button>
          <button style={topBtn} onClick={() => router.push("/billing")}>
            Billing
          </button>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 14, marginTop: 14 }}>
        {/* LEFT */}
        <section style={card}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>Your domains</div>
          <div style={{ opacity: 0.85, fontSize: 13, marginTop: 6 }}>{domains.length} domain(s)</div>

          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {domains.map((d) => (
              <button
                key={d.id}
                onClick={() => pickDomain(d)}
                style={{
                  ...listBtn,
                  borderColor:
                    selected?.id === d.id ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.18)",
                }}
              >
                <div style={{ fontWeight: 900 }}>{d.domain}</div>
                <div style={{ opacity: 0.85, fontSize: 12 }}>
                  {d.status} • {new Date(d.created_at).toLocaleString()}
                </div>
              </button>
            ))}

            {domains.length === 0 ? (
              <div style={{ opacity: 0.8, fontSize: 13 }}>No domains saved yet.</div>
            ) : null}
          </div>
        </section>

        {/* RIGHT */}
        <section style={card}>
          <div style={{ fontSize: 24, fontWeight: 900 }}>Connect your custom domain</div>
          <div style={{ opacity: 0.9, marginTop: 6 }}>
            When you’re done building your website, connect a domain you own (like <b>yourbusiness.com</b>) so visitors
            can find your site.
          </div>

          <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Your domain</div>
              <input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="yourbusiness.com"
                style={{ ...input, width: "100%" }}
              />
            </div>

            <button disabled={!canSubmit} style={primaryBtn} onClick={connectDomain}>
              Get DNS records
            </button>
          </div>

          {busy ? <div style={busyBox}>{busy}</div> : null}

          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 900 }}>Status</div>
            <div style={{ opacity: 0.92, marginTop: 6 }}>
              {selected ? (
                <>
                  <b>{selected.domain}</b> — <b>{selected.status}</b>
                  {selected.error_message ? <div style={{ marginTop: 6 }}>{selected.error_message}</div> : null}
                </>
              ) : (
                "No domain selected yet."
              )}
            </div>
          </div>

          <div style={{ marginTop: 16, ...subCard }}>
            <div style={{ fontSize: 16, fontWeight: 900 }}>Your DNS records</div>
            <div style={{ opacity: 0.9, marginTop: 8, whiteSpace: "pre-wrap" }}>{dnsRecordsText}</div>
          </div>

          <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button style={secondaryBtn} onClick={refreshDomains}>
              Refresh
            </button>
            <button style={secondaryBtn} onClick={() => router.push("/builder")}>
              Back to Builder
            </button>
          </div>

          <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a style={linkBtn} href="https://www.godaddy.com/" target="_blank" rel="noreferrer">
              Buy on GoDaddy →
            </a>
            <a style={linkBtn} href="https://www.ionos.com/" target="_blank" rel="noreferrer">
              Buy on IONOS →
            </a>
            <a style={linkBtn} href="https://www.namecheap.com/" target="_blank" rel="noreferrer">
              Buy on Namecheap →
            </a>
          </div>

          {debug ? (
            <div style={debugBox}>
              <div style={{ fontWeight: 900 }}>Debug</div>
              <div style={{ whiteSpace: "pre-wrap", fontSize: 12, opacity: 0.95 }}>{debug}</div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

/** styles */
const page: React.CSSProperties = {
  minHeight: "100vh",
  padding: 16,
  color: "white",
  background:
    "radial-gradient(1200px 600px at 20% 0%, rgba(255,255,255,0.18), transparent 60%), linear-gradient(135deg, rgb(124,58,237) 0%, rgb(109,40,217) 35%, rgb(91,33,182) 100%)",
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
};

const header: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.12)",
  border: "1px solid rgba(255,255,255,0.18)",
  borderRadius: 16,
  padding: 14,
  boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
};

const subCard: React.CSSProperties = {
  background: "rgba(0,0,0,0.18)",
  border: "1px solid rgba(255,255,255,0.18)",
  borderRadius: 14,
  padding: 12,
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

const listBtn: React.CSSProperties = {
  textAlign: "left",
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.10)",
  color: "white",
  cursor: "pointer",
};

const linkBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "rgba(255,255,255,0.14)",
  color: "white",
  fontWeight: 900,
  textDecoration: "none",
};

const busyBox: React.CSSProperties = {
  marginTop: 12,
  padding: 10,
  borderRadius: 12,
  background: "rgba(0,0,0,0.25)",
};

const debugBox: React.CSSProperties = {
  marginTop: 14,
  padding: 10,
  borderRadius: 12,
  background: "rgba(185, 28, 28, .25)",
  border: "1px solid rgba(185, 28, 28, .5)",
};







