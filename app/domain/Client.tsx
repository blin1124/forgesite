"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type DomainRow = {
  id: string;
  domain: string;
  status: string;
  vercel_verified: boolean;
  verification: any;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  site_id: string | null;
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
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState("");
  const [debug, setDebug] = useState("");
  const [rows, setRows] = useState<DomainRow[]>([]);
  const [dns, setDns] = useState<{ type: string; name: string; value: string }[]>([]);

  const canSave = useMemo(() => domain.trim().includes("."), [domain]);

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
  }, []);

  async function refresh() {
    try {
      const res = await fetch("/api/domain", { method: "GET" });
      const { json, text } = await readResponse(res);
      if (!res.ok) throw new Error(json?.error || text.slice(0, 200));
      setRows(Array.isArray(json?.domains) ? json.domains : []);
    } catch (e: any) {
      setDebug(e?.message || "Failed to load domains");
    }
  }

  async function saveDomain() {
    setBusy("");
    setDebug("");
    setDns([]);

    if (!canSave) return setBusy("Enter a valid domain (example: yourbusiness.com).");

    try {
      setBusy("Saving domain…");

      const res = await fetch("/api/domain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain }),
      });

      const { json, text } = await readResponse(res);
      if (!res.ok) throw new Error(json?.error || text.slice(0, 240));

      setDns(Array.isArray(json?.dns) ? json.dns : []);
      await refresh();

      setBusy("Saved ✅");
      setTimeout(() => setBusy(""), 1200);
    } catch (e: any) {
      setBusy(e?.message || "Save failed");
      setDebug(String(e?.stack || ""));
    }
  }

  async function verifyAgain(d: string) {
    setBusy("");
    setDebug("");
    setDns([]);

    try {
      setBusy("Checking DNS / verifying…");

      const res = await fetch("/api/domain", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain: d }),
      });

      const { json, text } = await readResponse(res);
      if (!res.ok) throw new Error(json?.error || text.slice(0, 240));

      setDns(Array.isArray(json?.dns) ? json.dns : []);
      await refresh();

      setBusy("Checked ✅");
      setTimeout(() => setBusy(""), 1200);
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

      <section style={{ ...card, marginTop: 14, maxWidth: 980 }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>Connect your custom domain</div>
        <div style={{ opacity: 0.9, marginTop: 8 }}>
          When you’re done building your website, connect a domain you own (like <b>yourbusiness.com</b>) so visitors can
          find your site easily.
        </div>

        <div style={{ marginTop: 14, fontWeight: 900 }}>Your domain</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, marginTop: 8 }}>
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="yourbusiness.com"
            style={input}
          />
          <button style={primaryBtn} onClick={saveDomain}>
            Save
          </button>
        </div>

        <div style={{ marginTop: 14, fontWeight: 900 }}>What happens next</div>
        <div style={{ marginTop: 8, opacity: 0.92, lineHeight: 1.55 }}>
          <div><b>Step 1:</b> Buy a domain from a registrar (GoDaddy, IONOS, Namecheap, etc.).</div>
          <div><b>Step 2:</b> In your registrar’s DNS settings, you’ll add the DNS records ForgeSite shows you.</div>
          <div><b>Step 3:</b> Once the DNS records are saved, ForgeSite will verify the connection automatically.</div>
          <div style={{ marginTop: 8 }}>DNS updates can take a bit (often minutes, sometimes longer).</div>
        </div>

        <div style={{ ...subCard, marginTop: 14 }}>
          <div style={{ fontWeight: 900 }}>Your DNS records</div>
          <div style={{ opacity: 0.9, marginTop: 6 }}>
            If your domain needs verification, we’ll show the required DNS records here.
          </div>

          {dns.length ? (
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {dns.map((r, idx) => (
                <div key={idx} style={dnsRow}>
                  <div><b>Type:</b> {r.type}</div>
                  <div style={{ wordBreak: "break-all" }}><b>Name:</b> {r.name}</div>
                  <div style={{ wordBreak: "break-all" }}><b>Value:</b> {r.value}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ marginTop: 10, opacity: 0.85 }}>
              No DNS records to show yet (your domain may already be verified, or Vercel didn’t return challenges).
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
          <button style={secondaryBtn} onClick={() => verifyAgain(domain.trim())} disabled={!domain.trim()}>
            I’ve added my DNS records →
          </button>
          <button style={secondaryBtn} onClick={() => router.push("/builder")}>
            Back to Builder
          </button>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
          <a style={linkBtn} href="https://www.godaddy.com" target="_blank" rel="noreferrer">Buy on GoDaddy →</a>
          <a style={linkBtn} href="https://www.ionos.com/domains" target="_blank" rel="noreferrer">Buy on IONOS →</a>
          <a style={linkBtn} href="https://www.namecheap.com/domains/" target="_blank" rel="noreferrer">Buy on Namecheap →</a>
        </div>

        {busy ? <div style={statusBox}>{busy}</div> : null}
        {debug ? (
          <div style={debugBox}>
            <div style={{ fontWeight: 900 }}>Debug</div>
            <div style={{ whiteSpace: "pre-wrap", fontSize: 12, opacity: 0.95 }}>{debug}</div>
          </div>
        ) : null}
      </section>

      <section style={{ ...card, marginTop: 14, maxWidth: 980 }}>
        <div style={{ fontSize: 18, fontWeight: 900 }}>Your saved domains</div>
        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          {rows.length === 0 ? (
            <div style={{ opacity: 0.85 }}>No domains saved yet.</div>
          ) : (
            rows.map((r) => (
              <div key={r.id} style={domainRow}>
                <div style={{ fontWeight: 900 }}>{r.domain}</div>
                <div style={{ opacity: 0.9 }}>
                  Status: <b>{r.status}</b> • Verified: <b>{String(r.vercel_verified)}</b>
                </div>
                {r.last_error ? <div style={{ color: "rgba(255,255,255,0.95)" }}>Error: {r.last_error}</div> : null}
                <div style={{ opacity: 0.75, fontSize: 12 }}>
                  Updated: {new Date(r.updated_at).toLocaleString()}
                </div>
                <div style={{ marginTop: 8 }}>
                  <button style={smallBtn} onClick={() => verifyAgain(r.domain)}>
                    Verify again
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
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

const linkBtn: React.CSSProperties = {
  ...secondaryBtn,
  display: "inline-flex",
  textDecoration: "none",
};

const statusBox: React.CSSProperties = {
  marginTop: 12,
  padding: 10,
  borderRadius: 12,
  background: "rgba(0,0,0,0.25)",
};

const debugBox: React.CSSProperties = {
  marginTop: 12,
  padding: 10,
  borderRadius: 12,
  background: "rgba(185, 28, 28, .25)",
  border: "1px solid rgba(185, 28, 28, .5)",
};

const dnsRow: React.CSSProperties = {
  padding: 10,
  borderRadius: 12,
  background: "rgba(255,255,255,0.10)",
  border: "1px solid rgba(255,255,255,0.18)",
};

const domainRow: React.CSSProperties = {
  padding: 12,
  borderRadius: 12,
  background: "rgba(255,255,255,0.10)",
  border: "1px solid rgba(255,255,255,0.18)",
};

const smallBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "rgba(255,255,255,0.14)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};






