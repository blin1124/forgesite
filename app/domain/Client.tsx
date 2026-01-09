"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type DomainRow = {
  id: string;
  domain: string;
  status: string;
  verified: boolean;
  dns_records: any | null;
  verification: any | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
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

export default function Client() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [token, setToken] = useState<string>("");

  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [selected, setSelected] = useState<DomainRow | null>(null);

  const [inputDomain, setInputDomain] = useState("");
  const [busy, setBusy] = useState("");
  const [debug, setDebug] = useState("");

  const authHeaders = useMemo(() => {
    const h: Record<string, string> = { "content-type": "application/json" };
    if (token) h.authorization = `Bearer ${token}`;
    return h;
  }, [token]);

  useEffect(() => {
    const run = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();
        const session = data?.session;

        setEmail(session?.user?.email || "");
        setToken(session?.access_token || "");
      } catch {
        setEmail("");
        setToken("");
      }
    };
    run();
  }, []);

  useEffect(() => {
    if (token) refreshList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function refreshList() {
    setBusy("");
    setDebug("");
    try {
      setBusy("Loading domains…");

      const res = await fetch("/api/domain/list", { method: "GET", headers: token ? { authorization: `Bearer ${token}` } : {} });
      const { text, json } = await readResponse(res);

      if (!res.ok) throw new Error(json?.error || `List failed (${res.status}): ${text.slice(0, 240)}`);

      const list = Array.isArray(json?.domains) ? json.domains : [];
      setDomains(list);

      // keep selection fresh
      if (selected) {
        const next = list.find((d: DomainRow) => d.id === selected.id) || null;
        setSelected(next);
      }

      setBusy("");
    } catch (e: any) {
      setBusy(e?.message || "List failed");
      setDebug(String(e?.stack || ""));
    }
  }

  async function getDnsRecords() {
    setBusy("");
    setDebug("");

    if (!token) return setBusy("Not signed in.");
    if (!inputDomain.trim()) return setBusy("Enter a domain first.");

    try {
      setBusy("Provisioning domain + fetching DNS records…");

      const res = await fetch("/api/domain/request", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ domain: inputDomain.trim() }),
      });

      const { text, json } = await readResponse(res);
      if (!res.ok) throw new Error(json?.error || `Request failed (${res.status}): ${text.slice(0, 240)}`);

      await refreshList();

      // select the domain we just requested
      const d = (json?.domain || "").toLowerCase();
      const found = domains.find((x) => x.domain.toLowerCase() === d) || null;
      setSelected(found);

      setBusy("DNS records ready ✅");
      setTimeout(() => setBusy(""), 1200);
    } catch (e: any) {
      setBusy(e?.message || "Request failed");
      setDebug(String(e?.stack || ""));
    }
  }

  async function verifyNow() {
    setBusy("");
    setDebug("");

    if (!token) return setBusy("Not signed in.");
    const d = (selected?.domain || inputDomain || "").trim();
    if (!d) return setBusy("Enter/select a domain first.");

    try {
      setBusy("Verifying with Vercel…");

      const res = await fetch("/api/domain/verify", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ domain: d }),
      });

      const { text, json } = await readResponse(res);
      if (!res.ok) throw new Error(json?.error || `Verify failed (${res.status}): ${text.slice(0, 240)}`);

      await refreshList();

      setBusy(json?.verified ? "Verified ✅" : "Not verified yet (still pending).");
      setTimeout(() => setBusy(""), 1600);
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

  const dnsText = useMemo(() => {
    const rec = selected?.dns_records;
    if (!rec) return "Enter a domain and click Get DNS records.";

    // Pretty print
    try {
      return JSON.stringify(rec, null, 2);
    } catch {
      return String(rec);
    }
  }, [selected]);

  const statusText = useMemo(() => {
    if (!selected) return "No domain selected yet.";
    if (selected.verified) return "✅ Verified";
    if (selected.status === "error") return "❌ Error (see Debug)";
    return "Pending verification…";
  }, [selected]);

  return (
    <main style={page}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
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
        {/* LEFT: list */}
        <section style={card}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>Your domains</div>
          <div style={{ opacity: 0.85, fontSize: 13, marginTop: 6 }}>{domains.length} domain(s)</div>

          <button style={{ ...secondaryBtn, marginTop: 12 }} onClick={refreshList}>
            Refresh list
          </button>

          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            {domains.length === 0 ? (
              <div style={{ opacity: 0.8, fontSize: 13 }}>No domains saved yet.</div>
            ) : null}

            {domains.map((d) => (
              <button
                key={d.id}
                onClick={() => {
                  setSelected(d);
                  setInputDomain(d.domain);
                  setDebug("");
                  setBusy("");
                }}
                style={{
                  ...siteBtn,
                  borderColor: selected?.id === d.id ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.18)",
                }}
              >
                <div style={{ fontWeight: 900 }}>{d.domain}</div>
                <div style={{ opacity: 0.85, fontSize: 12 }}>
                  {d.verified ? "Verified ✅" : d.status === "error" ? "Error ❌" : "Pending…"}
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* RIGHT: actions */}
        <section style={card}>
          <div style={{ fontSize: 24, fontWeight: 900 }}>Connect your custom domain</div>
          <div style={{ opacity: 0.9, marginTop: 6 }}>
            Enter a domain you own (like <b>yourbusiness.com</b>). We’ll show DNS records to add in GoDaddy, IONOS, Namecheap, etc — then we verify it.
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 900, opacity: 0.95 }}>Your domain</div>

            <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
              <input
                value={inputDomain}
                onChange={(e) => setInputDomain(e.target.value)}
                placeholder="yourbusiness.com"
                style={{ ...input, flex: 1, minWidth: 260 }}
              />

              <button style={primaryBtn} onClick={getDnsRecords}>Get DNS records</button>
              <button style={secondaryBtn} onClick={verifyNow}>Verify now</button>
              <button style={secondaryBtn} onClick={refreshList}>Refresh</button>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 900, opacity: 0.95 }}>Status</div>
            <div style={{ marginTop: 8, opacity: 0.92 }}>{statusText}</div>
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 900, opacity: 0.95 }}>DNS records to add</div>
            <div style={dnsBox}>
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12, opacity: 0.95 }}>{dnsText}</pre>
            </div>
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a style={linkBtn} href="https://www.godaddy.com/" target="_blank" rel="noreferrer">Buy on GoDaddy →</a>
            <a style={linkBtn} href="https://www.ionos.com/" target="_blank" rel="noreferrer">Buy on IONOS →</a>
            <a style={linkBtn} href="https://www.namecheap.com/" target="_blank" rel="noreferrer">Buy on Namecheap →</a>
          </div>

          {busy ? (
            <div style={{ marginTop: 12, padding: 10, borderRadius: 12, background: "rgba(0,0,0,0.25)" }}>
              {busy}
            </div>
          ) : null}

          {(selected?.last_error || debug) ? (
            <div style={{ marginTop: 12, padding: 10, borderRadius: 12, background: "rgba(185, 28, 28, .25)", border: "1px solid rgba(185, 28, 28, .5)" }}>
              <div style={{ fontWeight: 900 }}>Debug</div>
              <div style={{ whiteSpace: "pre-wrap", fontSize: 12, opacity: 0.95 }}>
                {selected?.last_error ? `DB error: ${selected.last_error}\n\n` : ""}
                {debug || ""}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  padding: 16,
  color: "white",
  background:
    "radial-gradient(1200px 600px at 20% 0%, rgba(255,255,255,0.18), transparent 60%), linear-gradient(135deg, rgb(124,58,237) 0%, rgb(109,40,217) 35%, rgb(91,33,182) 100%)",
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
};

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

const dnsBox: React.CSSProperties = {
  marginTop: 8,
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(0,0,0,0.18)",
};

const linkBtn: React.CSSProperties = {
  ...secondaryBtn,
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};










