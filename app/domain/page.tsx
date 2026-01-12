"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type DomainRow = {
  id: string;
  domain: string;
  site_id: string | null;
  status: string;
  verified: boolean;
  dns_records: any[] | null;
};

export default function DomainPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const siteId = sp.get("site") || "";

  const [domain, setDomain] = useState("");
  const [rows, setRows] = useState<DomainRow[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function loadDomains() {
    try {
      const res = await fetch("/api/domain/list");
      const json = await res.json();
      setRows(json.domains || []);
    } catch {
      setRows([]);
    }
  }

  async function connect() {
    setBusy("Connecting…");
    setError("");
    try {
      const res = await fetch("/api/domain/connect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          domain,
          site_id: siteId,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Connect failed");

      setDomain("");
      await loadDomains();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  async function verify(d: string) {
    setBusy("Verifying…");
    try {
      await fetch("/api/domain/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain: d }),
      });
      await loadDomains();
    } finally {
      setBusy("");
    }
  }

  useEffect(() => {
    loadDomains();
  }, []);

  return (
    <main style={page}>
      <div style={card}>
        <h1 style={{ fontSize: 28, fontWeight: 900 }}>Connect Domain</h1>
        <p style={{ opacity: 0.85 }}>Site ID: {siteId}</p>

        {error && <div style={err}>{error}</div>}

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="example.com"
            style={input}
          />
          <button onClick={connect} disabled={!domain || !siteId} style={btn}>
            Connect
          </button>
        </div>

        {busy && <div style={{ marginTop: 10 }}>{busy}</div>}

        <div style={{ marginTop:



