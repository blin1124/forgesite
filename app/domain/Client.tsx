"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type DomainRow = {
  id: string;
  user_id: string;
  domain: string;
  status: string;
  verified: boolean;
  created_at: string;
  dns_records: any | null;
  last_error: string | null;
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

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.12)",
  border: "1px solid rgba(255,255,255,0.18)",
  borderRadius: 16,
  padding: 14,
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
  whiteSpace: "nowrap",
};

const secondaryBtn: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "rgba(255,255,255,0.14)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

function normalizeDomain(raw: string) {
  const s = (raw || "").trim().toLowerCase();
  if (!s) return "";
  // remove protocol + paths
  const noProto = s.replace(/^https?:\/\//, "").split("/")[0];
  return noProto;
}

export default function Client() {
  const router = useRouter();

  const [email, setEmail] = useState<string>("");
  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [domainInput, setDomainInput] = useState<string>("");
  const [statusText, setStatusText] = useState<string>("No domain selected yet.");
  const [dnsRecords, setDnsRecords] = useState<any | null>(null);

  const [busy, setBusy] = useState<string>("");
  const [debug, setDebug] = useState<string>("");

  const selected = useMemo(
    () => domains.find((d) => d.id === selectedId) || null,
    [domains, selectedId]
  );

  useEffect(() => {
    (async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();
        setEmail(data?.session?.user?.email || "");
      } catch {
        setEmail("");
      }
      await refreshList();
    })();
  }, []);

  async function refreshList() {
    setBusy("");
    setDebug("");
    try {
      const res = await fetch("/api/domain/list", { method: "GET" });
      const { text, json } = await readResponse(res);
      if (!res.ok) throw new Error(json?.error || `List failed (${res.status}): ${text.slice(0, 240)}`);

      const rows = Array.isArray(json?.domains) ? (json.domains as DomainRow[]) : [];
      setDomains(rows);

      // keep selection if still exists
      if (selectedId && !rows.some((r) => r.id === selectedId)) {
        setSelectedId(null);
        setStatusText("No domain selected yet.");
        setDnsRecords(null);
      }
    } catch (e: any) {
      setDebug(e?.message || "Failed to list domains");
    }
  }

  function selectDomain(id: string) {
    setSelectedId(id);
    const d = domains.find((x) => x.id === id);
    setDomainInput(d?.domain || "");
    setStatusText(
      d ? `${d.status}${d.verified ? " ✅" : ""}${d.last_error ? ` — ${d.last_error}` : ""}` : "No domain selected yet."
    );
    setDnsRecords(d?.dns_records || null);
    setBusy("");
    setDebug("");
  }

  async function getDnsRecords() {
    setBusy("");
    setDebug("");
    setDnsRecords(null);

    const domain = normalizeDomain(domainInput);
    if (!domain) return setBusy("Enter a domain first.");

    try {
      setBusy("Requesting DNS records…");

      const res = await fetch("/api/domain/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain }),
      });

      const { text, json } = await readResponse(res);
      if (!res.ok) throw new Error(json?.error || `Request failed (${res.status}): ${text.slice(0, 240)}`);

      // API returns: { id, domain, status, verified, dns_records }
      const id = String(json?.id || "");
      if (id) setSelectedId(id);

      setStatusText(String(json?.status || "pending"));
      setDnsRecords(json?.dns_records || null);

      await refreshList();
      setBusy("");
    } catch (e: any) {
      setBusy(e?.message || "Request failed");
      setDebug(String(e?.stack || ""));
    }
  }

  async function verifyNow() {
    setBusy("");
    setDebug("");

    const domain = normalizeDomain(domainInput);
    if (!domain) return setBusy("Enter a domain first.");

    try {
      setBusy("Verifying…");

      const res = await fetch("/api/domain/connect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain }),
      });

      const { text, json } = await readResponse(res);
      if (!res.ok) throw new Error(json?.error || `Verify failed (${res.status}): ${text.slice(0, 240)}`);

      setStatusText(String(json?.status || "pending") + (json?.verified ? " ✅" : ""));
      if (json?.dns_records) setDnsRecords(json.dns_records);

      await refreshList();
      setBusy("");
    } catch (e: any) {
      setBusy(e?.message || "Verify failed");
      setDebug(String(e?.stack || ""));
    }
  }

  async function logout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login?next=%2Fdomain");
  }

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
          <div style={{ fontSize: 44, fontWeight: 900, lineHeight: 1 }}>Domain</div>
          <div style={{ opacity: 0.9 }}>
            Signed in as <b>{email || "unknown"}</b>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button style={topBtn} onClick={() => router.push("/builder")}>← Back to Builder</button>
          <button style={topBtn} onClick={() => router.push("/billing")}>Billing</button>
          <button style={topBtn} onClick={logout}>Log out</button>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 14, marginTop: 14 }}>
        {/* LEFT LIST */}
        <section style={card}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>Your domains</div>
          <div style={{ opacity: 0.85, fontSize: 13, marginTop: 6 }}>{domains.length} domain(s)</div>

          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {domains.map((d) => (
              <button
                key={d.id}
                onClick={() => selectDomain(d.id)}
                style={{
                  textAlign: "left",
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: selectedId === d.id ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.10)",
                  color: "white",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 900 }}>{d.domain}</div>
                <div style={{ opacity: 0.9, fontSize: 12 }}>
                  {d.status}{d.verified ? " ✅" : ""} • {new Date(d.created_at).toLocaleString()}
                </div>
              </button>
            ))}
            {domains.length === 0 ? (
              <div style={{ opacity: 0.85, fontSize: 13, marginTop: 6 }}>No domains saved yet.</div>
            ) : null}
          </div>
        </section>

        {/* RIGHT MAIN */}
        <section style={card}>
          <div style={{ fontSize: 28, fontWeight: 900 }}>Connect your custom domain</div>
          <div style={{ opacity: 0.9, marginTop: 6 }}>
            When you’re done building your website, connect a domain you own (like <b>yourbusiness.com</b>) so visitors can find your site.
          </div>

          <div style={{ marginTop: 14, fontSize: 14, fontWeight: 900 }}>Your domain</div>
          <div style={{ display: "flex", gap: 10, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              placeholder="yourbusiness.com"
              style={{ ...input, flex: 1, minWidth: 260 }}
            />
            <button style={primaryBtn} onClick={getDnsRecords}>Get DNS records</button>
            <button style={secondaryBtn} onClick={verifyNow}>Verify now</button>
            <button style={secondaryBtn} onClick={refreshList}>Refresh</button>
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 900 }}>Status</div>
            <div style={{ opacity: 0.92, marginTop: 6 }}>{statusText}</div>
          </div>

          <div style={{ marginTop: 14, padding: 12, borderRadius: 12, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(0,0,0,0.18)" }}>
            <div style={{ fontWeight: 900 }}>Your DNS records</div>
            <div style={{ opacity: 0.85, marginTop: 6, fontSize: 13 }}>
              Add these records in your domain registrar’s DNS settings. Then click <b>Verify now</b>.
            </div>

            {!dnsRecords ? (
              <div style={{ marginTop: 10, opacity: 0.9 }}>Enter a domain and click Get DNS records.</div>
            ) : (
              <pre style={{ marginTop: 10, whiteSpace: "pre-wrap", fontSize: 12, opacity: 0.95 }}>
                {JSON.stringify(dnsRecords, null, 2)}
              </pre>
            )}
          </div>

          <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button style={secondaryBtn} onClick={() => window.open("https://www.godaddy.com/domains", "_blank")}>
              Buy on GoDaddy →
            </button>
            <button style={secondaryBtn} onClick={() => window.open("https://www.ionos.com/domains", "_blank")}>
              Buy on IONOS →
            </button>
            <button style={secondaryBtn} onClick={() => window.open("https://www.namecheap.com/domains/", "_blank")}>
              Buy on Namecheap →
            </button>
          </div>

          {busy ? (
            <div style={{ marginTop: 12, padding: 10, borderRadius: 12, background: "rgba(0,0,0,0.25)" }}>
              {busy}
            </div>
          ) : null}

          {debug ? (
            <div
              style={{
                marginTop: 12,
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
        </section>
      </div>
    </main>
  );
}









