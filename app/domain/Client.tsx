"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type DnsRecord = {
  type: string;
  name: string;
  value: string;
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
  return { ok: res.ok, status: res.status, json };
}

function normalizeInputDomain(raw: string) {
  const d = (raw || "").trim().toLowerCase();
  return d.replace(/^https?:\/\//, "").split("/")[0];
}

function pickRecords(payload: any): DnsRecord[] | null {
  const candidates = [
    payload?.dns_records,
    payload?.records,
    payload?.verification?.records,
    payload?.config?.records,
  ];

  for (const c of candidates) {
    if (Array.isArray(c) && c.length) {
      return c.map((r: any) => ({
        type: String(r.type || "").toUpperCase(),
        name: String(r.name || r.host || ""),
        value: String(r.value || r.data || r.target || ""),
        ttl: r.ttl ?? null,
      }));
    }
  }
  return null;
}

export default function DomainClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const siteId = useMemo(() => sp.get("siteId") || "", [sp]);

  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");

  const [domain, setDomain] = useState("");
  const cleanDomain = useMemo(() => normalizeInputDomain(domain), [domain]);

  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [isError, setIsError] = useState(false);

  const [dnsRecords, setDnsRecords] = useState<DnsRecord[] | null>(null);
  const [details, setDetails] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);

  // ---- Auth guard (this prevents login loop) ----
  useEffect(() => {
    (async () => {
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
    })();
  }, [router]);

  async function call(path: string, body: any) {
    setMsg("");
    setIsError(false);
    setDnsRecords(null);
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

  // -------- BUTTON ACTIONS --------

  async function requestDomain() {
    if (!cleanDomain) return fail("Enter a domain first.");
    setBusy("Requesting DNS records…");

    const r = await call("/api/domain/request", {
      domain: cleanDomain,
      site_id: siteId || null,
    });

    if (!r.ok) {
      return fail(r.json?.error || "Request failed", r.json);
    }

    const recs = pickRecords(r.json);

    if (!recs?.length) {
      return fail(
        "Request succeeded, but no DNS records were returned. The server must return DNS records for customers to copy into their registrar.",
        r.json
      );
    }

    setDnsRecords(recs);
    ok("DNS records generated ✅ Add these at your domain registrar, then click Verify DNS.", r.json);
  }

  async function verifyDns() {
    if (!cleanDomain) return fail("Enter a domain first.");
    setBusy("Verifying DNS…");

    const r = await call("/api/domain/verify", { domain: cleanDomain });

    if (!r.ok) return fail(r.json?.error || "Verify failed", r.json);

    ok("Verify complete ✅ If pending, wait and click Check status.", r.json);
  }

  async function checkStatus() {
    if (!cleanDomain) return fail("Enter a domain first.");
    setBusy("Checking status…");

    const r = await call("/api/domain/status", { domain: cleanDomain });

    if (!r.ok) return fail(r.json?.error || "Status failed", r.json);

    ok("Status updated ✅", r.json);
  }

  async function connectDomain() {
    if (!cleanDomain) return fail("Enter a domain first.");
    setBusy("Connecting…");

    const r = await call("/api/domain/connect", { domain: cleanDomain });

    if (!r.ok) {
      const code = r.json?.details?.error?.code;
      if (code === "domain_already_in_use") {
        return fail(
          "This domain is already attached to one of your projects. Remove it from that project first.",
          r.json
        );
      }
      return fail(r.json?.error || "Connect failed", r.json);
    }

    ok("Domain connected successfully ✅", r.json);
  }

  function resetUi() {
    setBusy("");
    setMsg("");
    setIsError(false);
    setDnsRecords(null);
    setDetails(null);
    setShowDetails(false);
  }

  // -------- UI --------

  return (
    <main style={page}>
      <div style={card}>
        <h1>Connect Domain</h1>
        <div>Signed in as <b>{email}</b></div>

        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="yourdomain.com"
          style={input}
        />

        <div style={{ marginTop: 10 }}>
          <button onClick={requestDomain}>Request DNS records</button>
          <button onClick={verifyDns}>Verify DNS</button>
          <button onClick={checkStatus}>Check status</button>
          <button onClick={connectDomain}>Connect</button>
          <button onClick={resetUi}>Reset</button>
        </div>

        {busy && <div>{busy}</div>}
        {msg && <div style={{ color: isError ? "red" : "white" }}>{msg}</div>}

        {dnsRecords && (
          <pre>{JSON.stringify(dnsRecords, null, 2)}</pre>
        )}

        {details && (
          <>
            <button onClick={() => setShowDetails(v => !v)}>
              {showDetails ? "Hide details" : "Show details"}
            </button>
            {showDetails && <pre>{JSON.stringify(details, null, 2)}</pre>}
          </>
        )}
      </div>
    </main>
  );
}

// ---- styles (unchanged behavior) ----
const page: React.CSSProperties = { minHeight: "100vh", padding: 24, color: "white" };
const card: React.CSSProperties = { maxWidth: 900, margin: "0 auto" };
const input: React.CSSProperties = { width: "100%", padding: 12 };



























