"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type DomainRow = {
  id: string;
  domain: string;
  status: string;
  verification: any;
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

function extractDnsRecords(verification: any) {
  // Vercel typically returns "verification" array or "verification" object depending on endpoint
  // We’ll safely support a few shapes.
  const records: { type: string; name: string; value: string; reason?: string }[] = [];

  const arr = verification?.verification || verification?.verificationRecords || verification?.dns || null;

  if (Array.isArray(arr)) {
    for (const r of arr) {
      const type = String(r?.type || r?.recordType || "").toUpperCase();
      const name = String(r?.domain || r?.name || r?.host || "");
      const value = String(r?.value || r?.target || r?.data || "");
      const reason = r?.reason ? String(r.reason) : undefined;
      if (type && (name || value)) records.push({ type, name, value, reason });
    }
  }

  // Some Vercel payloads use "verification" with { type, domain, value }
  if (records.length === 0 && verification?.verification && typeof verification.verification === "object") {
    const v = verification.verification;
    if (v?.type && (v?.domain || v?.name) && (v?.value || v?.target)) {
      records.push({
        type: String(v.type).toUpperCase(),
        name: String(v.domain || v.name),
        value: String(v.value || v.target),
      });
    }
  }

  return records;
}

export default function Client() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [domainInput, setDomainInput] = useState("");

  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [selected, setSelected] = useState<DomainRow | null>(null);

  const [verification, setVerification] = useState<any>(null);
  const dnsRecords = useMemo(() => extractDnsRecords(verification), [verification]);

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
      await refreshList();
    };
    run();
  }, []);

  async function refreshList() {
    setDebug("");
    try {
      const res = await fetch("/api/domain/list");
      const { text, json } = await readResponse(res);
      if (!res.ok) throw new Error(json?.error || `List failed (${res.status}): ${text.slice(0, 200)}`);
      const list = Array.isArray(json?.domains) ? json.domains : [];
      setDomains(list);

      // keep selection in sync
      if (selected) {
        const next = list.find((d: DomainRow) => d.id === selected.id) || null;
        setSelected(next);
        setVerification(next?.verification || null);
      }
    } catch (e: any) {
      setDebug(e?.message || "List failed");
    }
  }

  async function getDnsRecords() {
    setBusy("");
    setDebug("");

    const domain = domainInput.trim();
    if (!domain) return setBusy("Enter a domain first.");

    try {
      setBusy("Contacting Vercel…");

      const res = await fetch("/api/domain/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain }),
      });

      const { text, json } = await readResponse(res);
      if (!res.ok) throw new Error(json?.error || `Request failed (${res.status}): ${text.slice(0, 200)}`);

      const row = json?.domain as DomainRow | undefined;
      if (row) {
        setSelected(row);
        setVerification(row.verification || null);
      }

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

    const dom = selected?.domain || domainInput.trim();
    if (!dom) return setBusy("Enter/select a domain first.");

    try {
      setBusy("Checking verification…");

      const res = await fetch("/api/domain/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain: dom }),
      });

      const { text, json } = await readResponse(res);
      if (!res.ok) throw new Error(json?.error || `Verify failed (${res.status}): ${text.slice(0, 200)}`);

      setVerification(json?.verification || null);
      await refreshList();

      const verified = !!json?.verification?.verified;
      setBusy(verified ? "Verified ✅" : "Not verified yet — add DNS records then try again.");
      setTimeout(() => setBusy(""), 2000);
    } catch (e: any) {
      setBusy(e?.message || "Verify failed");
      setDebug(String(e?.stack || ""));
    }
  }

  async function logout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login?next=%2Fbuilder");
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
        {/* LEFT LIST */}
        <section style={card}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>Your domains</div>
          <div style={{ opacity: 0.85, fontSize: 13, marginTop: 4 }}>{domains.length} domain(s)</div>

          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {domains.length === 0 ? (
              <div style={{ opacity: 0.8, fontSize: 13 }}>No domains saved yet.</div>
            ) : null}

            {domains.map((d) => (
              <button
                key={d.id}
                style={{
                  ...siteBtn,
                  borderColor: selected?.id === d.id ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.18)",
                }}
                onClick={() => {
                  setSelected(d);
                  setDomainInput(d.domain);
                  setVerification(d.verification || null);
                  setBusy("");
                  setDebug("");
                }}
              >
                <div style={{ fontWeight: 900 }}>{d.domain}</div>
                <div style={{ opacity: 0.85, fontSize: 12 }}>
                  Status: <b>{d.status}</b>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* MAIN */}
        <section style={card}>
          <div style={{ fontSize: 26, fontWeight: 900 }}>Connect your custom domain</div>
          <div style={{ opacity: 0.9, marginTop: 6 }}>
            Enter a domain you own (like <b>yourbusiness.com</b>). We’ll show the exact DNS records to add in GoDaddy,
            IONOS, Namecheap, etc — then we verify it.
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14, alignItems: "center" }}>
            <input
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              placeholder="yourbusiness.com"
              style={{ ...input, flex: 1, minWidth: 260 }}
            />
            <button style={primaryBtn} onClick={getDnsRecords}>
              Get DNS records
            </button>
            <button style={secondaryBtn} onClick={verifyNow}>
              Verify now
            </button>
            <button style={secondaryBtn} onClick={refreshList}>
              Refresh
            </button>
          </div>

          <div style={{ marginTop: 12, opacity: 0.95 }}>
            <div style={{ fontSize: 16, fontWeight: 900 }}>Status</div>
            <div style={{ marginTop: 6 }}>
              {verification?.verified ? (
                <span>
                  ✅ <b>Verified</b> — your domain is connected.
                </span>
              ) : (
                <span>No domain verified yet.</span>
              )}
            </div>
          </div>

          <div style={{ marginTop: 12, padding: 12, borderRadius: 14, background: "rgba(0,0,0,0.18)", border: "1px solid rgba(255,255,255,0.18)" }}>
            <div style={{ fontSize: 16, fontWeight: 900 }}>DNS records to add</div>
            <div style={{ opacity: 0.85, fontSize: 13, marginTop: 4 }}>
              Add these records in your registrar’s DNS settings. After saving, come back and click <b>Verify now</b>.
            </div>

            {dnsRecords.length === 0 ? (
              <div style={{ marginTop: 10, opacity: 0.85 }}>
                Enter a domain and click <b>Get DNS records</b>.
              </div>
            ) : (
              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                {dnsRecords.map((r, idx) => (
                  <div key={idx} style={{ padding: 10, borderRadius: 12, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)" }}>
                    <div style={{ fontWeight: 900 }}>{r.type}</div>
                    <div style={{ fontSize: 13, opacity: 0.95 }}>
                      <div><b>Name/Host:</b> {r.name || "(root)"}</div>
                      <div style={{ wordBreak: "break-all" }}><b>Value/Target:</b> {r.value}</div>
                      {r.reason ? <div style={{ opacity: 0.85 }}><b>Note:</b> {r.reason}</div> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
            <a style={secondaryBtn as any} href="https://www.godaddy.com/domains" target="_blank" rel="noreferrer">
              Buy on GoDaddy →
            </a>
            <a style={secondaryBtn as any} href="https://www.ionos.com/domains" target="_blank" rel="noreferrer">
              Buy on IONOS →
            </a>
            <a style={secondaryBtn as any} href="https://www.namecheap.com/domains/" target="_blank" rel="noreferrer">
              Buy on Namecheap →
            </a>
          </div>

          {busy ? (
            <div style={{ marginTop: 12, padding: 10, borderRadius: 12, background: "rgba(0,0,0,0.25)" }}>
              {busy}
            </div>
          ) : null}

          {debug ? (
            <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: "rgba(185, 28, 28, .25)", border: "1px solid rgba(185, 28, 28, .5)" }}>
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










