"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!url || !anon) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return createClient(url, anon);
}

async function readJson(res: Response) {
  const text = await res.text();
  let json: any = {};
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { ok: res.ok, status: res.status, json, text };
}

export default function DomainClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const siteId = useMemo(() => sp.get("siteId") || "", [sp]);

  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");

  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [details, setDetails] = useState<any>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const supabase = getSupabase();
        const { data } = await supabase.auth.getSession();
        const session = data?.session;

        if (!session?.access_token) {
          router.replace("/login?next=/domain");
          return;
        }

        setToken(session.access_token);
        setEmail(session.user?.email || "");
      } catch {
        router.replace("/login?next=/domain");
      }
    };
    run();
  }, [router]);

  async function call(path: string, body: any) {
    setMsg("");
    setDetails(null);

    const res = await fetch(path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    return readJson(res);
  }

  async function requestDomain() {
    if (!domain.trim()) return setMsg("Enter a domain first.");
    setBusy("Requesting…");

    const r = await call("/api/domain/request", { domain: domain.trim(), site_id: siteId || null });

    if (!r.ok) {
      setBusy("");
      setMsg(r.json?.error || `Request failed (${r.status})`);
      setDetails(r.json);
      return;
    }

    setBusy("");
    setMsg("Requested ✅ Now add the DNS records shown below, then click Verify.");
    setDetails(r.json);
  }

  async function checkStatus() {
    if (!domain.trim()) return setMsg("Enter a domain first.");
    setBusy("Checking status…");

    const r = await call("/api/domain/status", { domain: domain.trim() });

    if (!r.ok) {
      setBusy("");
      setMsg(r.json?.error || `Status failed (${r.status})`);
      setDetails(r.json);
      return;
    }

    setBusy("");
    setMsg("Status updated ✅");
    setDetails(r.json);
  }

  async function verify() {
    if (!domain.trim()) return setMsg("Enter a domain first.");
    setBusy("Verifying…");

    const r = await call("/api/domain/verify", { domain: domain.trim() });

    if (!r.ok) {
      setBusy("");
      setMsg(r.json?.error || `Verify failed (${r.status})`);
      setDetails(r.json);
      return;
    }

    setBusy("");
    setMsg("Verify complete ✅");
    setDetails(r.json);
  }

  async function connect() {
    if (!domain.trim()) return setMsg("Enter a domain first.");
    setBusy("Connecting…");

    const r = await call("/api/domain/connect", { domain: domain.trim() });

    if (!r.ok) {
      setBusy("");
      setMsg(r.json?.error || `Connect failed (${r.status})`);
      setDetails(r.json);
      return;
    }

    setBusy("");
    setMsg("Connected ✅");
    setDetails(r.json);
  }

  return (
    <main style={page}>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>Connect Domain</h1>
            <div style={{ opacity: 0.85, marginTop: 6 }}>
              Signed in as <b>{email || "unknown"}</b>
              {siteId ? (
                <>
                  {" "}
                  • Site ID: <b>{siteId}</b>
                </>
              ) : null}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={() => router.push("/builder")} style={secondaryBtn}>
              Back to Builder
            </button>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <label style={{ fontWeight: 900, display: "block", marginBottom: 8 }}>
            Domain (example: customer.com)
          </label>
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="yourdomain.com"
            style={input}
          />

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
            <button style={primaryBtn} onClick={requestDomain} disabled={!token}>
              Request DNS records
            </button>
            <button style={secondaryBtn} onClick={verify} disabled={!token}>
              Verify DNS
            </button>
            <button style={secondaryBtn} onClick={checkStatus} disabled={!token}>
              Check status
            </button>
            <button style={secondaryBtn} onClick={connect} disabled={!token}>
              Connect in Vercel
            </button>
          </div>

          {busy ? <div style={note}>{busy}</div> : null}
          {msg ? <div style={note}>{msg}</div> : null}

          {details ? (
            <pre style={pre}>{JSON.stringify(details, null, 2)}</pre>
          ) : (
            <div style={{ marginTop: 14, opacity: 0.85, fontSize: 13 }}>
              Tip: Click <b>Request DNS records</b>, add them in GoDaddy, then click <b>Verify DNS</b>.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  padding: 24,
  color: "white",
  background:
    "radial-gradient(1200px 600px at 20% 0%, rgba(255,255,255,0.18), transparent 60%), linear-gradient(135deg, rgb(124,58,237) 0%, rgb(109,40,217) 35%, rgb(91,33,182) 100%)",
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
};

const card: React.CSSProperties = {
  maxWidth: 920,
  margin: "0 auto",
  background: "rgba(255,255,255,0.10)",
  border: "1px solid rgba(255,255,255,0.18)",
  borderRadius: 18,
  padding: 18,
  boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
};

const input: React.CSSProperties = {
  width: "100%",
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

const note: React.CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 12,
  background: "rgba(0,0,0,0.22)",
  border: "1px solid rgba(255,255,255,0.14)",
};

const pre: React.CSSProperties = {
  marginTop: 14,
  padding: 12,
  borderRadius: 12,
  background: "rgba(0,0,0,0.35)",
  border: "1px solid rgba(255,255,255,0.14)",
  overflow: "auto",
  maxHeight: 420,
  fontSize: 12,
};












