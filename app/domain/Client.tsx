"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type DnsRecord = { type: string; name: string; value: string; ttl?: number };

type DomainRow = {
  id: string;
  domain: string;
  status: string;
  verified: boolean;
  dns_records: DnsRecord[] | null;
  created_at: string;
  updated_at: string;
  last_error?: string | null;
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

async function authedFetch(path: string, init?: RequestInit) {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token || "";

  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  return res;
}

export default function Client() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [selected, setSelected] = useState<DomainRow | null>(null);

  const [inputDomain, setInputDomain] = useState("");
  const [busy, setBusy] = useState("");
  const [debug, setDebug] = useState("");

  const dnsRecords = useMemo(() => selected?.dns_records || [], [selected]);

  useEffect(() => {
    (async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();
        setEmail(data?.session?.user?.email || "");
      } catch {
        setEmail("");
      }
      await refresh();
    })();
  }, []);

  async function refresh() {
    setBusy("");
    setDebug("");
    try {
      const res = await authedFetch("/api/domain/list", { method: "GET" });
      const { text, json } = await readResponse(res);
      if (!res.ok) throw new Error(json?.error || `List failed (${res.status}): ${text.slice(0, 240)}`);

      const list: DomainRow[] = Array.isArray(json?.domains) ? json.domains : [];
      setDomains(list);

      // keep selection in sync
      if (selected) {
        const found = list.find((d) => d.domain === selected.domain);
        if (found) setSelected(found);
      }
    } catch (e: any) {
      setDebug(e?.message || "Failed to load domains");
    }
  }

  async function getDnsRecords() {
    setBusy("");
    setDebug("");

    const d = inputDomain.trim();
    if (!d) return setBusy("Enter a domain first.");

    try {
      setBusy("Requesting DNS records…");

      const res = await authedFetch("/api/domain/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain: d }),
      });

      const { text, json } = await readResponse(res);
      if (!res.ok) throw new Error(json?.error || `Request failed (${res.status}): ${text.slice(0, 240)}`);

      await refresh();

      const domainReturned = String(json?.domain || "");
      if (domainReturned) {
        const found = domains.find((x) => x.domain === domainReturned);
        if (found) setSelected(found);
      }

      setBusy("DNS records loaded ✅");
      setTimeout(() => setBusy(""), 1200);
    } catch (e: any) {
      setBusy(e?.message || "Request failed");
      setDebug(String(e?.stack || ""));
    }
  }

  async function verifyNow() {
    setBusy("");
    setDebug("");

    const d = (selected?.domain || inputDomain || "").trim();
    if (!d) return setBusy("Enter/select a domain first.");

    try {
      setBusy("Verifying…");

      const res = await authedFetch("/api/domain/connect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain: d }),
      });

      const { text, json } = await readResponse(res);
      if (!res.ok) throw new Error(json?.error || `Verify failed (${res.status}): ${text.slice(0, 240)}`);

      await refresh();

      const verified = Boolean(json?.verified);
      setBusy(verified ? "Verified ✅" : "Not verified yet — keep waiting for DNS to propagate.");
      setTimeout(() => setBusy(""), 2200);
    } catch (e: any) {
      setBusy(e?.message || "Verify failed");
      setDebug(String(e?.stack || ""));
    }
  }

  async function refreshSelectedStatus() {
    setBusy("");
    setDebug("");

    const d = (selected?.domain || inputDomain || "").trim();
    if (!d) return setBusy("Enter/select a domain first.");

    try {
      setBusy("Refreshing status…");

      const res = await authedFetch("/api/domain/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain: d }),
      });

      const { text, json } = await readResponse(res);
      if (!res.ok) throw new Error(json?.error || `Status failed (${res.status}): ${text.slice(0, 240)}`);

      await refresh();

      const verified = Boolean(json?.verified);
      setBusy(verified ? "Verified ✅" : "Still pending. DNS may need more time.");
      setTimeout(() => setBusy(""), 1600);
    } catch (e: any) {
      setBusy(e?.message || "Refresh failed");
      setDebug(String(e?.stack || ""));
    }
  }

  async function logout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login?next=%2Fbuilder");
  }

  return (
    <main style={shell}>
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
          <button style={topBtn} onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 14, marginTop: 14 }}>
        {/* LEFT */}
        <section style={card}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>Your domains</div>
          <div style={{ opacity: 0.85, fontSize: 13, marginTop: 6 }}>{domains.length} domain(s)</div>

          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {domains.map((d) => (
              <button
                key={d.id}
                style={{
                  ...siteBtn,
                  borderColor: selected?.domain === d.domain ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.18)",
                }}
                onClick={() => {
                  setSelected(d);
                  setInputDomain(d.domain);
                  setDebug("");
                  setBusy("");
                }}
              >
                <div style={{ fontWeight: 900 }}>{d.domain}</div>
                <div style={{ opacity: 0.85, fontSize: 12 }}>
                  {d.verified ? "✅ verified" : `⏳ ${d.status || "pending"}`}
                </div>
              </button>
            ))}
          </div>

          <button style={{ ...secondaryBtn, marginTop: 12 }} onClick={refresh}>
            Refresh list
          </button>
        </section>

        {/* RIGHT */}
        <section style={card}>
          <div style={{ fontSize: 24, fontWeight: 900 }}>Connect your custom domain</div>
          <div style={{ opacity: 0.9, marginTop: 6 }}>
            Enter a domain you own (like <b>yourbusiness.com</b>). We’ll show DNS records to add in GoDaddy, IONOS,
            Namecheap, etc — then we verify it.
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Your domain</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input
                value={inputDomain}
                onChange={(e) => setInputDomain(e.target.value)}
                placeholder="yourbusiness.com"
                style={{ ...input, flex: 1, minWidth: 260 }}
              />
              <button style={primaryBtn} onClick={getDnsRecords}>
                Get DNS records
              </button>
              <button style={secondaryBtn} onClick={verifyNow}>
                Verify now
              </button>
              <button style={secondaryBtn} onClick={refreshSelectedStatus}>
                Refresh
              </button>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 900 }}>Status</div>
            <div style={{ opacity: 0.9, marginTop: 6 }}>
              {selected ? (
                <>
                  <b>{selected.domain}</b> — {selected.verified ? "✅ Verified" : `⏳ ${selected.status || "pending"}`}
                </>
              ) : (
                "No domain selected yet."
              )}
            </div>
          </div>

          <div style={{ marginTop: 14, ...subcard }}>
            <div style={{ fontWeight: 900 }}>DNS records to add</div>
            <div style={{ opacity: 0.9, marginTop: 6 }}>
              Add these records in your registrar’s DNS settings. After saving, come back and click <b>Verify now</b>.
            </div>

            <div style={{ marginTop: 10 }}>
              {dnsRecords?.length ? (
                <div style={{ display: "grid", gap: 8 }}>
                  {dnsRecords.map((r, idx) => (
                    <div key={idx} style={dnsRow}>
                      <div style={{ fontWeight: 900, width: 70 }}>{r.type}</div>
                      <div style={{ width: 180, opacity: 0.95, wordBreak: "break-all" }}>{r.name}</div>
                      <div style={{ flex: 1, opacity: 0.95, wordBreak: "break-all" }}>{r.value}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ opacity: 0.85 }}>Enter a domain and click Get DNS records.</div>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
            <a style={linkBtn as any} href="https://www.godaddy.com/" target="_blank" rel="noreferrer">
              Buy on GoDaddy →
            </a>
            <a style={linkBtn as any} href="https://www.ionos.com/" target="_blank" rel="noreferrer">
              Buy on IONOS →
            </a>
            <a style={linkBtn as any} href="https://www.namecheap.com/" target="_blank" rel="noreferrer">
              Buy on Namecheap →
            </a>
          </div>

          {busy ? <div style={{ marginTop: 14, ...toast }}>{busy}</div> : null}

          {debug ? (
            <div style={{ marginTop: 14, ...errorBox }}>
              <div style={{ fontWeight: 900 }}>Debug</div>
              <div style={{ whiteSpace: "pre-wrap", fontSize: 12, opacity: 0.95 }}>{debug}</div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

const shell: React.CSSProperties = {
  minHeight: "100vh",
  padding: 16,
  color: "white",
  background:
    "radial-gradient(1200px 600px at 20% 0%, rgba(255,255,255,0.18), transparent 60%), linear-gradient(135deg, rgb(124,58,237) 0%, rgb(109,40,217) 35%, rgb(91,33,182) 100%)",
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
};

const header: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 };

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.12)",
  border: "1px solid rgba(255,255,255,0.18)",
  borderRadius: 16,
  padding: 14,
  boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
};

const subcard: React.CSSProperties = {
  background: "rgba(0,0,0,0.12)",
  border: "1px solid rgba(255,255,255,0.16)",
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

const linkBtn: React.CSSProperties = {
  ...secondaryBtn,
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const siteBtn: React.CSSProperties = {
  textAlign: "left",
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.10)",
  color: "white",
  cursor: "pointer",
};

const toast: React.CSSProperties = {
  padding: 10,
  borderRadius: 12,
  background: "rgba(0,0,0,0.25)",
};

const errorBox: React.CSSProperties = {
  padding: 10,
  borderRadius: 12,
  background: "rgba(185, 28, 28, .25)",
  border: "1px solid rgba(185, 28, 28, .5)",
};

const dnsRow: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "flex-start",
  padding: 10,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.08)",
};








