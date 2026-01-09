"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type DomainRow = {
  id: string;
  domain: string;
  status?: string;
  verified?: boolean;
  dns_records?: any;
  verification?: any;
  created_at?: string;
  updated_at?: string;
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
  return input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
}

export default function Client() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");

  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [domainInput, setDomainInput] = useState("");

  const [selected, setSelected] = useState<DomainRow | null>(null);
  const [dnsRecords, setDnsRecords] = useState<any[] | null>(null);
  const [statusText, setStatusText] = useState<string>("No domain selected yet.");

  const [busy, setBusy] = useState("");
  const [debug, setDebug] = useState("");

  const canCallApi = useMemo(() => !!token, [token]);

  useEffect(() => {
    const run = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();

        const em = data?.session?.user?.email || "";
        const tk = data?.session?.access_token || "";

        setEmail(em);
        setToken(tk);
      } catch {
        setEmail("");
        setToken("");
      }
    };
    run();
  }, []);

  useEffect(() => {
    if (!token) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function apiFetch(path: string, body?: any) {
    const res = await fetch(path, {
      method: body ? "POST" : "GET",
      headers: {
        ...(body ? { "content-type": "application/json" } : {}),
        authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return res;
  }

  async function refresh() {
    setBusy("");
    setDebug("");

    if (!canCallApi) return;

    try {
      const res = await apiFetch("/api/domain/list");
      const { text, json } = await readResponse(res);

      if (!res.ok) throw new Error(json?.error || `List failed (${res.status}): ${text.slice(0, 200)}`);

      const rows: DomainRow[] = Array.isArray(json?.domains) ? json.domains : [];
      setDomains(rows);

      // Keep selection synced
      if (selected?.domain) {
        const match = rows.find((r) => r.domain === selected.domain) || null;
        setSelected(match);
      }
    } catch (e: any) {
      setDebug(e?.message || "Failed to load domains");
    }
  }

  async function getDns() {
    setBusy("");
    setDebug("");
    setDnsRecords(null);

    if (!canCallApi) return setDebug("Not signed in.");
    const domain = normalizeDomain(domainInput);
    if (!domain || !domain.includes(".")) return setDebug("Enter a valid domain (example.com).");

    try {
      setBusy("Getting DNS records…");

      const res = await apiFetch("/api/domain/request", { domain });
      const { text, json } = await readResponse(res);

      if (!res.ok) throw new Error(json?.error || `Request failed (${res.status}): ${text.slice(0, 240)}`);

      const recs = Array.isArray(json?.dns_records) ? json.dns_records : null;
      setDnsRecords(recs);
      setStatusText("DNS records generated. Add them at your registrar, then click Verify now.");

      await refresh();
      setBusy("");
    } catch (e: any) {
      setBusy("");
      setDebug(e?.message || "Request failed");
    }
  }

  async function verifyNow() {
    setBusy("");
    setDebug("");

    if (!canCallApi) return setDebug("Not signed in.");
    const domain = normalizeDomain(domainInput);
    if (!domain) return setDebug("Enter a domain first.");

    try {
      setBusy("Checking status…");

      const res = await apiFetch("/api/domain/status", { domain });
      const { text, json } = await readResponse(res);

      if (!res.ok) throw new Error(json?.error || `Status failed (${res.status}): ${text.slice(0, 240)}`);

      const verified = !!json?.verified;
      const status = String(json?.status || "pending");

      setStatusText(verified ? "✅ Verified!" : `Status: ${status}. If you just updated DNS, wait a bit and try again.`);
      if (json?.dns_records) setDnsRecords(json.dns_records);

      await refresh();
      setBusy("");
    } catch (e: any) {
      setBusy("");
      setDebug(e?.message || "Status check failed");
    }
  }

  async function saveDomainOnly() {
    // Keep button behavior safe (just writes record)
    setBusy("");
    setDebug("");

    if (!canCallApi) return setDebug("Not signed in.");
    const domain = normalizeDomain(domainInput);
    if (!domain) return setDebug("Enter a domain first.");

    try {
      setBusy("Saving…");

      const res = await apiFetch("/api/domain/connect", { domain });
      const { text, json } = await readResponse(res);

      if (!res.ok) throw new Error(json?.error || `Save failed (${res.status}): ${text.slice(0, 240)}`);

      setStatusText("Saved. Next: Get DNS records.");
      await refresh();

      setBusy("");
    } catch (e: any) {
      setBusy("");
      setDebug(e?.message || "Save failed");
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

      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 14, marginTop: 14 }}>
        <section style={card}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>Your domains</div>
          <div style={{ opacity: 0.85, fontSize: 13, marginTop: 6 }}>
            {domains.length} domain(s)
          </div>

          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {domains.length === 0 ? (
              <div style={{ opacity: 0.85, fontSize: 13 }}>No domains saved yet.</div>
            ) : (
              domains.map((d) => (
                <button
                  key={d.id}
                  onClick={() => {
                    setSelected(d);
                    setDomainInput(d.domain);
                    setDnsRecords(Array.isArray(d.dns_records) ? d.dns_records : null);
                    setStatusText(d.verified ? "✅ Verified!" : `Status: ${d.status || "pending"}`);
                    setDebug("");
                  }}
                  style={{
                    ...siteBtn,
                    borderColor:
                      selected?.id === d.id ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.18)",
                  }}
                >
                  <div style={{ fontWeight: 900 }}>{d.domain}</div>
                  <div style={{ opacity: 0.85, fontSize: 12 }}>
                    {d.verified ? "Verified" : d.status || "pending"}
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        <section style={card}>
          <div style={{ fontSize: 28, fontWeight: 900 }}>Connect your custom domain</div>
          <div style={{ opacity: 0.9, marginTop: 6 }}>
            Enter a domain you own (like <b>yourbusiness.com</b>). We’ll show DNS records to add in GoDaddy,
            IONOS, Namecheap, etc — then we verify it.
          </div>

          <div style={{ marginTop: 14, fontWeight: 900 }}>Your domain</div>
          <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
            <input
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              placeholder="yourbusiness.com"
              style={{ ...input, flex: 1, minWidth: 280 }}
            />
            <button style={primaryBtn} onClick={getDns}>
              Get DNS records
            </button>
            <button style={secondaryBtn} onClick={verifyNow}>
              Verify now
            </button>
            <button style={secondaryBtn} onClick={refresh}>
              Refresh
            </button>
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 900 }}>Status</div>
            <div style={{ opacity: 0.92, marginTop: 6 }}>{statusText}</div>
          </div>

          <div style={{ marginTop: 14, padding: 12, borderRadius: 14, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(0,0,0,0.12)" }}>
            <div style={{ fontWeight: 900 }}>DNS records to add</div>
            <div style={{ opacity: 0.9, marginTop: 6 }}>
              Add these records in your registrar’s DNS settings. After saving, come back and click <b>Verify now</b>.
            </div>

            {!dnsRecords ? (
              <div style={{ opacity: 0.9, marginTop: 10 }}>
                Enter a domain and click <b>Get DNS records</b>.
              </div>
            ) : (
              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                {dnsRecords.map((r, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: 10,
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.18)",
                      background: "rgba(255,255,255,0.08)",
                      display: "grid",
                      gap: 4,
                    }}
                  >
                    <div style={{ fontWeight: 900 }}>
                      {r.type} {r.name} → {r.value}
                    </div>
                    {r.note ? <div style={{ opacity: 0.85, fontSize: 12 }}>{r.note}</div> : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
            <button style={secondaryBtn} onClick={saveDomainOnly}>
              Save
            </button>

            <a style={secondaryBtn as any} href="https://www.godaddy.com" target="_blank" rel="noreferrer">
              Buy on GoDaddy →
            </a>
            <a style={secondaryBtn as any} href="https://www.ionos.com" target="_blank" rel="noreferrer">
              Buy on IONOS →
            </a>
            <a style={secondaryBtn as any} href="https://www.namecheap.com" target="_blank" rel="noreferrer">
              Buy on Namecheap →
            </a>
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
};

const secondaryBtn: React.CSSProperties = {
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

const siteBtn: React.CSSProperties = {
  textAlign: "left",
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.10)",
  color: "white",
  cursor: "pointer",
};










