"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type DnsRecord = {
  type: string; // A, CNAME, TXT
  name: string; // @, www, _vercel, etc
  value: string; // target
  ttl?: number | null;
};

async function readJson(res: Response) {
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { ok: res.ok, status: res.status, json, text };
}

function normalizeInputDomain(raw: string) {
  const d = (raw || "").trim().toLowerCase();
  const noProto = d.replace(/^https?:\/\//, "");
  const noPath = noProto.split("/")[0] || "";
  return noPath.replace(/\.$/, "");
}

function pickRecords(payload: any): DnsRecord[] | null {
  if (!payload) return null;

  const candidates = [
    payload?.dns_records,
    payload?.records,
    payload?.config?.records,
    payload?.verification?.records,
    payload?.verification?.dns,
    payload?.dns,
    payload?.json?.dns_records,
  ];

  for (const c of candidates) {
    if (Array.isArray(c)) {
      return c
        .map((r: any) => ({
          type: String(r?.type || "").toUpperCase(),
          name: String(r?.name || r?.host || r?.hostname || ""),
          value: String(r?.value || r?.data || r?.target || r?.destination || ""),
          ttl: r?.ttl ?? null,
        }))
        .filter((r: DnsRecord) => r.type && r.name !== undefined && r.value !== undefined);
    }
  }
  return null;
}

function isAlreadyInUse(payload: any) {
  const code = String(payload?.details?.error?.code || payload?.code || "");
  const msg = String(payload?.error || payload?.message || "");
  return code.includes("domain_already_in_use") || msg.toLowerCase().includes("already in use");
}

function isSchemaCache(payload: any) {
  const msg = String(payload?.error || payload?.message || "");
  return msg.toLowerCase().includes("schema cache");
}

function hasAnyDnsRecords(payload: any) {
  const recs = pickRecords(payload);
  return Array.isArray(recs) && recs.length > 0;
}

export default function DomainClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const siteId = useMemo(() => sp.get("siteId") || "", [sp]);

  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");

  const [domain, setDomain] = useState("");
  const cleanDomain = useMemo(() => normalizeInputDomain(domain), [domain]);

  const [busy, setBusy] = useState<string>("");
  const [msg, setMsg] = useState<string>("");
  const [isError, setIsError] = useState(false);

  const [details, setDetails] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);

  const [dnsRecords, setDnsRecords] = useState<DnsRecord[] | null>(null);

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

  // IMPORTANT: Don’t clear dnsRecords on every click; only replace when we have new ones
  async function call(path: string, body: any) {
    setMsg("");
    setIsError(false);
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

  function ok(message: string, payload?: any) {
    setBusy("");
    setIsError(false);
    setMsg(message);
    setDetails(payload ?? null);
  }

  function fail(message: string, payload?: any) {
    setBusy("");
    setIsError(true);
    setMsg(message);
    setDetails(payload ?? null);
  }

  function requireDomainAndToken() {
    if (!cleanDomain) {
      fail("Enter a domain first.");
      return false;
    }
    if (!cleanDomain.includes(".")) {
      fail("That doesn’t look like a valid domain. Example: customer.com");
      return false;
    }
    if (!token) {
      fail("Not signed in.");
      return false;
    }
    return true;
  }

  async function requestDomain() {
    if (!requireDomainAndToken()) return;

    setBusy("Requesting DNS records…");

    const r = await call("/api/domain/request", {
      domain: cleanDomain,
      site_id: siteId || null,
    });

    if (!r.ok) {
      if (isSchemaCache(r.json)) {
        return fail(
          "Supabase schema cache hasn’t refreshed yet (you just added columns). Wait 2–5 minutes and try again.",
          r.json
        );
      }
      return fail(r.json?.error || `Request failed (${r.status})`, r.json);
    }

    const recs = pickRecords(r.json);

    // ✅ FIX: if server returns NO records, treat as failure (customers need copy/paste DNS)
    if (recs?.length) {
      setDnsRecords(recs);
      return ok("DNS records generated ✅ Add these at your registrar, then click Verify DNS.", r.json);
    }

    return fail(
      "Request succeeded but NO DNS records were returned.\n\nThis means /api/domain/request is not returning the DNS records customers must copy into GoDaddy/Namecheap/Ionos.\n\nFix required: update /api/domain/request to return DNS records (A + CNAME and/or verification TXT/CNAME).",
      r.json
    );
  }

  async function verifyDns() {
    if (!requireDomainAndToken()) return;
    setBusy("Verifying DNS…");

    const r = await call("/api/domain/verify", { domain: cleanDomain });

    if (!r.ok) {
      if (isSchemaCache(r.json)) {
        return fail(
          "Supabase schema cache hasn’t refreshed yet (you just added columns). Wait 2–5 minutes and try again.",
          r.json
        );
      }
      return fail(r.json?.error || `Verify failed (${r.status})`, r.json);
    }

    const recs = pickRecords(r.json);
    if (recs?.length) setDnsRecords(recs);

    ok("Verify complete ✅ If it’s pending, wait a bit and click Check status.", r.json);
  }

  async function checkStatus() {
    if (!requireDomainAndToken()) return;
    setBusy("Checking status…");

    const r = await call("/api/domain/status", { domain: cleanDomain });

    if (!r.ok) {
      if (isSchemaCache(r.json)) {
        return fail(
          "Supabase schema cache hasn’t refreshed yet (you just added columns). Wait 2–5 minutes and try again.",
          r.json
        );
      }
      return fail(r.json?.error || `Status failed (${r.status})`, r.json);
    }

    const recs = pickRecords(r.json);
    if (recs?.length) setDnsRecords(recs);

    const status = String(r.json?.status || "unknown");
    const verified = Boolean(r.json?.vercel_verified ?? r.json?.verified ?? false);

    ok(`Status updated ✅ (${status}${verified ? ", verified" : ""})`, r.json);
  }

  async function connectDomain() {
    if (!requireDomainAndToken()) return;

    const alreadyVerified =
      Boolean(details?.vercel_verified ?? details?.verified ?? false) ||
      Boolean(details?.status && String(details.status).toLowerCase().includes("verified"));

    if (alreadyVerified) {
      return ok(
        "Already verified ✅ No further action needed.\nIf your site isn’t loading yet, wait for DNS propagation.",
        details
      );
    }

    // Guardrail: if Request never gave DNS records, Connect will be confusing
    if (!dnsRecords?.length && details && !hasAnyDnsRecords(details)) {
      setIsError(true);
      setMsg(
        "Connect can fail or be misleading until DNS records are shown.\nClick Request DNS records first — if it returns no DNS records, /api/domain/request must be fixed."
      );
      return;
    }

    setBusy("Connecting…");

    const r = await call("/api/domain/connect", { domain: cleanDomain });

    if (!r.ok) {
      if (isAlreadyInUse(r.json)) {
        setBusy("");
        setIsError(false);
        setDetails(r.json);
        setMsg(
          "That domain is already attached (good sign). ✅ Now click Check status.\n" +
            "If status stays pending, you still need the exact DNS records from Request DNS records."
        );
        return;
      }

      if (isSchemaCache(r.json)) {
        return fail(
          "Supabase schema cache hasn’t refreshed yet (you just added columns). Wait 2–5 minutes and try again.",
          r.json
        );
      }

      return fail(r.json?.error || `Connect failed (${r.status})`, r.json);
    }

    ok("Connected ✅ Now click Check status until it shows verified.", r.json);
  }

  function resetUi() {
    setBusy("");
    setMsg("");
    setIsError(false);
    setDetails(null);
    setDnsRecords(null);
    setShowDetails(false);
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

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={() => router.push("/builder")} style={secondaryBtn}>
              Back to Builder
            </button>
            <button onClick={resetUi} style={secondaryBtn}>
              Reset
            </button>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <label style={{ fontWeight: 900, display: "block", marginBottom: 8 }}>
            Domain (example: customer.com)
          </label>

          <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="yourdomain.com" style={input} />

          {cleanDomain ? (
            <div style={{ marginTop: 8, opacity: 0.85, fontSize: 13 }}>
              We'll use: <b>{cleanDomain}</b>
            </div>
          ) : null}

          <div style={{ marginTop: 12, opacity: 0.85, fontSize: 13 }}>
            Recommended order: <b>Request DNS records</b> → update DNS at registrar → <b>Verify DNS</b> →{" "}
            <b>Connect</b>.
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
            <button style={primaryBtn} onClick={requestDomain} disabled={!token || !!busy}>
              Request DNS records
            </button>
            <button style={secondaryBtn} onClick={verifyDns} disabled={!token || !!busy}>
              Verify DNS
            </button>
            <button style={secondaryBtn} onClick={checkStatus} disabled={!token || !!busy}>
              Check status
            </button>
            <button style={secondaryBtn} onClick={connectDomain} disabled={!token || !!busy}>
              Connect
            </button>
          </div>

          {busy ? <div style={note}>{busy}</div> : null}

          {msg ? (
            <div
              style={{
                ...note,
                background: isError ? "rgba(185, 28, 28, .25)" : "rgba(0,0,0,0.22)",
                border: isError ? "1px solid rgba(185, 28, 28, .5)" : "1px solid rgba(255,255,255,0.14)",
              }}
            >
              {msg}
            </div>
          ) : null}

          {dnsRecords?.length ? (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>DNS records to add</div>
              <div style={{ overflowX: "auto" }}>
                <table style={table}>
                  <thead>
                    <tr>
                      <th style={th}>Type</th>
                      <th style={th}>Name/Host</th>
                      <th style={th}>Value/Target</th>
                      <th style={th}>TTL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dnsRecords.map((r, i) => (
                      <tr key={i}>
                        <td style={td}>{r.type}</td>
                        <td style={td}>{r.name}</td>
                        <td style={{ ...td, wordBreak: "break-all" }}>{r.value}</td>
                        <td style={td}>{r.ttl ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 8, opacity: 0.85, fontSize: 13 }}>
                Tip: add each record under <b>DNS</b> at your registrar and keep TTL default unless specified.
              </div>
            </div>
          ) : null}

          {details ? (
            <div style={{ marginTop: 14 }}>
              <button type="button" style={secondaryBtn} onClick={() => setShowDetails((v) => !v)}>
                {showDetails ? "Hide details" : "Show details"}
              </button>
              {showDetails ? <pre style={pre}>{JSON.stringify(details, null, 2)}</pre> : null}
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}

// --- styles below ---
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
  marginTop: 12,
  padding: 12,
  borderRadius: 12,
  background: "rgba(0,0,0,0.35)",
  border: "1px solid rgba(255,255,255,0.14)",
  overflow: "auto",
  maxHeight: 420,
  fontSize: 12,
};

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  background: "rgba(0,0,0,0.18)",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 12,
  overflow: "hidden",
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: 10,
  fontWeight: 900,
  borderBottom: "1px solid rgba(255,255,255,0.14)",
};

const td: React.CSSProperties = {
  padding: 10,
  borderBottom: "1px solid rgba(255,255,255,0.10)",
  verticalAlign: "top",
};
































