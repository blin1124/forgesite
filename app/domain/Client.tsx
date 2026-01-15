"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type DnsRecord = {
  type: string;      // A, CNAME, TXT, etc
  name: string;      // @, www, _verification, etc
  value: string;     // target value
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
  // strip protocol + path if user pastes full URL
  const noProto = d.replace(/^https?:\/\//, "");
  const noPath = noProto.split("/")[0] || "";
  return noPath;
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

  async function call(path: string, body: any) {
    setMsg("");
    setIsError(false);
    setDetails(null);
    setDnsRecords(null);

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

  function setOk(message: string, payload?: any) {
    setBusy("");
    setIsError(false);
    setMsg(message);
    setDetails(payload ?? null);
  }

  function setFail(message: string, payload?: any) {
    setBusy("");
    setIsError(true);
    setMsg(message);
    setDetails(payload ?? null);
  }

  async function requestDomain() {
    if (!cleanDomain) return setFail("Enter a domain first.");
    if (!token) return setFail("Not signed in.");

    setBusy("Requesting DNS records…");

    const r = await call("/api/domain/request", {
      domain: cleanDomain,
      site_id: siteId || null,
    });

    if (!r.ok) {
      const m = r.json?.error || `Request failed (${r.status})`;
      return setFail(m, r.json);
    }

    // Try to extract dns records from common shapes
    const records =
      (Array.isArray(r.json?.dns_records) ? r.json.dns_records : null) ||
      (Array.isArray(r.json?.records) ? r.json.records : null) ||
      (Array.isArray(r.json?.config?.records) ? r.json.config.records : null) ||
      null;

    if (records && Array.isArray(records)) {
      setDnsRecords(records);
      setOk("DNS records generated ✅ Add these at your registrar (GoDaddy), then click Verify DNS.", r.json);
      return;
    }

    // If backend returns no records, still guide user
    setOk("Requested ✅ Now add the DNS records your system provides, then click Verify DNS.", r.json);
  }

  async function verify() {
    if (!cleanDomain) return setFail("Enter a domain first.");
    if (!token) return setFail("Not signed in.");

    setBusy("Verifying DNS…");

    const r = await call("/api/domain/verify", { domain: cleanDomain });

    if (!r.ok) {
      const m = r.json?.error || `Verify failed (${r.status})`;
      return setFail(m, r.json);
    }

    // If verify returns records, show them too
    const records =
      (Array.isArray(r.json?.dns_records) ? r.json.dns_records : null) ||
      (Array.isArray(r.json?.records) ? r.json.records : null) ||
      null;

    if (records && Array.isArray(records)) setDnsRecords(records);

    setOk("Verify complete ✅ If it’s still pending, wait a bit and click Check status.", r.json);
  }

  async function checkStatus() {
    if (!cleanDomain) return setFail("Enter a domain first.");
    if (!token) return setFail("Not signed in.");

    setBusy("Checking status…");

    const r = await call("/api/domain/status", { domain: cleanDomain });

    if (!r.ok) {
      const m = r.json?.error || `Status failed (${r.status})`;
      return setFail(m, r.json);
    }

    const status = String(r.json?.status || "unknown");
    const verified = Boolean(r.json?.vercel_verified ?? r.json?.verified ?? false);

    // Capture records if returned
    const records =
      (Array.isArray(r.json?.dns_records) ? r.json.dns_records : null) ||
      (Array.isArray(r.json?.records) ? r.json.records : null) ||
      null;

    if (records && Array.isArray(records)) setDnsRecords(records);

    setOk(`Status updated ✅ (${status}${verified ? ", verified" : ""})`, r.json);
  }

  async function connect() {
    if (!cleanDomain) return setFail("Enter a domain first.");
    if (!token) return setFail("Not signed in.");

    setBusy("Connecting…");

    const r = await call("/api/domain/connect", { domain: cleanDomain });

    if (!r.ok) {
      const m = r.json?.error || `Connect failed (${r.status})`;

      // Common friendly guidance
      if (String(r.json?.details?.error?.code || "").includes("domain_already_in_use")) {
        return setFail(
          "That domain is already attached to one of your projects. Remove it from the project Domains list first, then try again.",
          r.json
        );
      }

      return setFail(m, r.json);
    }

    setOk("Connected ✅ Your domain is now attached.", r.json);
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

          <div style={{ display: "flex", gap: 10




















