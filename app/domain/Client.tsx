"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type ApiResult = {
  ok: boolean;
  status: number;
  json: any;
  text: string;
};

async function readJson(res: Response): Promise<ApiResult> {
  const text = await res.text();
  let json: any = {};
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { ok: res.ok, status: res.status, json, text };
}

function normalizeDomainInput(v: string) {
  let d = (v || "").trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "");
  d = d.replace(/^www\./, "");
  d = d.split("/")[0] || "";
  return d;
}

export default function DomainClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const siteId = useMemo(() => sp.get("siteId") || "", [sp]);

  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");

  const [domain, setDomain] = useState("");
  const normDomain = useMemo(() => normalizeDomainInput(domain), [domain]);

  const [busy, setBusy] = useState<string>("");
  const [msg, setMsg] = useState<string>("");
  const [details, setDetails] = useState<any>(null);

  // Track progress to encourage correct order
  const [hasRequested, setHasRequested] = useState(false);
  const [hasVerified, setHasVerified] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
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

  function showError(r: ApiResult, fallback: string) {
    const apiErr =
      r.json?.error ||
      r.json?.message ||
      r.json?.details?.error?.message ||
      r.json?.details?.error?.code ||
      fallback;

    setBusy("");
    setMsg(typeof apiErr === "string" ? apiErr : fallback);
    setDetails(r.json ?? { raw: r.text });
  }

  async function requestDnsRecords() {
    if (!normDomain) return setMsg("Enter a domain first.");
    setBusy("Requesting DNS records…");

    const r = await call("/api/domain/request", {
      domain: normDomain,
      site_id: siteId || null,
    });

    if (!r.ok) return showError(r, `Request failed (${r.status})`);

    // Many implementations return dns_records here; if present, we can mark requested.
    setHasRequested(true);
    setBusy("");
    setMsg("Requested ✅ Add the DNS records shown below at your domain registrar, then click Verify.");
    setDetails(r.json);
  }

  async function verifyDns() {
    if (!normDomain) return setMsg("Enter a domain first.");
    if (!hasRequested) {
      // still allow, but warn
      setMsg("Tip: Usually you click Request DNS records first, add them, then Verify.");
    }

    setBusy("Verifying DNS…");
    const r = await call("/api/domain/verify", { domain: normDomain });

    if (!r.ok) return showError(r, `Verify failed (${r.status})`);

    // Your API likely returns vercel_verified or similar; we set local flag regardless.
    setHasVerified(true);
    setBusy("");
    setMsg("Verified ✅ Now you can Connect.");
    setDetails(r.json);
  }

  async function checkStatus() {
    if (!normDomain) return setMsg("Enter a domain first.");
    setBusy("Checking status…");

    const r = await call("/api/domain/status", { domain: normDomain });

    if (!r.ok) return showError(r, `Status failed (${r.status})`);

    // If API reports verified, reflect it
    const v =
      Boolean(r.json?.domain?.verified) ||
      Boolean(r.json?.vercel_verified) ||
      Boolean(r.json?.verified);

    if (v) setHasVerified(true);

    setBusy("");
    setMsg("Status updated ✅");
    setDetails(r.json);
  }

  async function connectDomain() {
    if (!normDomain) return setMsg("Enter a domain first.");
    if (!hasVerified) {
      setMsg("Verify DNS first (or run Check status) before connecting.");
      return;
    }

    setBusy("Connecting…");
    const r = await call("/api/domain/connect", { domain: normDomain });

    if (!r.ok) {
      // Special-case: domain already added to a project
      const code = r.json?.details?.error?.code || r.json?.error?.code;
      const message = r.json?.error || r.json?.details?.error?.message;

      if (String(message || "").toLowerCase().includes("already in use")) {
        setBusy("");
        setMsg("This domain is already connected. Use Check status (or remove it from the other project) then try again.");
        setDetails(r.json);
        return;
      }

      if (code === "domain_already_in_use") {
        setBusy("");
        setMsg("This domain is already connected somewhere. If you own it, remove it from the other project and try again.");
        setDetails(r.json);
        return;
      }

      return showError(r, `Connect failed (${r.status})`);
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

          <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85 }}>
            We’ll use: <b>{normDomain || "—"}</b>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
            <button style={primaryBtn} onClick={requestDnsRecords} disabled={!token || !normDomain}>
              Request DNS records
            </button>

            <button style={secondaryBtn} onClick={verifyDns} disabled={!token || !normDomain}>
              Verify DNS
            </button>

            <button style={secondaryBtn} onClick={checkStatus} disabled={!token || !normDomain}>
              Check status
            </button>

            <button style={secondaryBtn} onClick={connectDomain} disabled={!token || !normDomain}>
              Connect
            </button>
          </div>

          <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9 }}>
            Recommended order: <b>Request DNS records</b> → update DNS at registrar → <b>Verify DNS</b> → <b>Connect</b>.
          </div>

          {busy ? <div style={note}>{busy}</div> : null}
          {msg ? <div style={note}>{msg}</div> : null}

          {details ? (
            <pre style={pre}>{JSON.stringify(details, null, 2)}</pre>
          ) : (
            <div style={{ marginTop: 14, opacity: 0.85, fontSize: 13 }}>
              Tip: Click <b>Request DNS records</b>, add them in your registrar (GoDaddy), then click <b>Verify DNS</b>.
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
  whiteSpace: "pre-wrap",
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



















