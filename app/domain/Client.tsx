"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!url || !anon) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return createClient(url, anon);
}

function normalizeDomainInput(v: string) {
  let d = (v || "").trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "");
  d = d.replace(/\/.*$/, "");
  d = d.replace(/\.$/, "");
  return d;
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

function friendlyErrorMessage(payload: any): string {
  const msg =
    payload?.error ||
    payload?.message ||
    payload?.details?.error?.message ||
    payload?.details?.message ||
    payload?.details?.error?.code ||
    "Request failed.";

  const code = payload?.details?.error?.code || payload?.code;

  if (code === "domain_already_in_use" || String(msg).toLowerCase().includes("already in use")) {
    return (
      "That domain is already attached to one of your projects. " +
      "Remove it from Vercel → Project → Settings → Domains (or any other project it’s on), then try again."
    );
  }

  if (String(msg).toLowerCase().includes("schema cache")) {
    return (
      "Your database just changed (new columns). Supabase can take a few minutes to refresh schema cache. " +
      "Wait 2–5 minutes, then try again."
    );
  }

  return String(msg);
}

export default function DomainClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const siteId = useMemo(() => sp.get("siteId") || "", [sp]);

  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");

  const [domainInput, setDomainInput] = useState("");
  const domain = useMemo(() => normalizeDomainInput(domainInput), [domainInput]);

  const [busy, setBusy] = useState<string>("");
  const [msg, setMsg] = useState<string>("");
  const [details, setDetails] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);

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

  function requireDomain(): boolean {
    if (!domain) {
      setMsg("Enter a domain first.");
      return false;
    }
    if (!domain.includes(".")) {
      setMsg("That doesn’t look like a real domain (missing a dot). Example: customer.com");
      return false;
    }
    return true;
  }

  async function requestDns() {
    if (!requireDomain()) return;
    setBusy("Requesting DNS records…");
    setShowDetails(false);

    const r = await call("/api/domain/request", { domain, site_id: siteId || null });

    setBusy("");
    if (!r.ok) {
      setMsg(friendlyErrorMessage(r.json));
      setDetails(r.json);
      return;
    }

    setMsg("DNS records created ✅ Add the records at your registrar, then click Verify DNS.");
    setDetails(r.json);
  }

  async function verifyDns() {
    if (!requireDomain()) return;
    setBusy("Verifying DNS…");
    setShowDetails(false);

    const r = await call("/api/domain/verify", { domain });

    setBusy("");
    if (!r.ok) {
      setMsg(friendlyErrorMessage(r.json));
      setDetails(r.json);
      return;
    }

    setMsg("Verify complete ✅ If it’s pending, wait a bit and click Check status.");
    setDetails(r.json);
  }

  async function checkStatus() {
    if (!requireDomain()) return;
    setBusy("Checking status…");
    setShowDetails(false);

    const r = await call("/api/domain/status", { domain });

    setBusy("");
    if (!r.ok) {
      setMsg(friendlyErrorMessage(r.json));
      setDetails(r.json);
      return;
    }

    setMsg("Status updated ✅");
    setDetails(r.json);
  }

  async function connect() {
    if (!requireDomain()) return;
    setBusy("Connecting…");
    setShowDetails(false);

    const r = await call("/api/domain/connect", { domain });

    setBusy("");
    if (!r.ok) {
      setMsg(friendlyErrorMessage(r.json));
      setDetails(r.json);
      return;
    }

    setMsg("Connected ✅ Your site should now load on this domain once DNS propagates.");
    setDetails(r.json);
  }

  function reset() {
    setDomainInput("");
    setBusy("");
    setMsg("");
    setDetails(null);
    setShowDetails(false);
  }

  const connectLabel = "Connect";

  const isError = msg.toLowerCase().includes("already attached") || msg.toLowerCase().includes("failed");
  const hint =
    "Recommended order: Request DNS records → update DNS at registrar → Verify DNS → Connect.";

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
            <button onClick={reset} style={secondaryBtn}>
              Reset
            </button>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <label style={{ fontWeight: 900, display: "block", marginBottom: 8 }}>
            Domain (example: customer.com)
          </label>

          <input
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
            placeholder="yourdomain.com"
            style={input}
          />

          {domain ? (
            <div style={{ marginTop: 8, opacity: 0.9, fontSize: 13 }}>
              We&apos;ll use: <b>{domain}</b>
            </div>
          ) : null}

          <div style={{ marginTop: 10, opacity: 0.85, fontSize: 13 }}>{hint}</div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
            <button style={primaryBtn} onClick={requestDns} disabled={!token || !!busy}>
              Request DNS records
            </button>
            <button style={secondaryBtn} onClick={verifyDns} disabled={!token || !!busy}>
              Verify DNS
            </button>
            <button style={secondaryBtn} onClick={checkStatus} disabled={!token || !!busy}>
              Check status
            </button>
            <button style={secondaryBtn} onClick={connect} disabled={!token || !!busy}>
              {connectLabel}
            </button>
          </div>

          {busy ? <div style={note}>{busy}</div> : null}

          {msg ? (
            <div
              style={{
                ...note,
                background: isError ? "rgba(185, 28, 28, .20)" : "rgba(0,0,0,0.22)",
                border: isError ? "1px solid rgba(185, 28, 28, .45)" : "1px solid rgba(255,255,255,0.14)",
              }}
            >
              {msg}
            </div>
          ) : null}

          {details ? (
            <div style={{ marginTop: 12 }}>
              <button
                onClick={() => setShowDetails((v) => !v)}
                style={{
                  ...secondaryBtn,
                  padding: "10px 12px",
                  fontSize: 13,
                  borderRadius: 10,
                }}
              >
                {showDetails ? "Hide details" : "Show details"}
              </button>

              {showDetails ? <pre style={pre}>{JSON.stringify(details, null, 2)}</pre> : null}
            </div>
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






















