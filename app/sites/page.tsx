"use client";

import React, { useEffect, useMemo, useState } from "react";

type SiteRow = {
  id: string;
  template: string | null;
  content: string | null;
  created_at: string | null;
  html: string | null;
  prompt: string | null;
  name: string | null;
};

export default function SitesPage() {
  const [rows, setRows] = useState<SiteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/sites/list", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to load sites");
      setRows(Array.isArray(data?.sites) ? data.sites : []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load sites");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => {
      const hay = `${r.name || ""} ${r.prompt || ""} ${r.id || ""} ${r.created_at || ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, q]);

  function shareUrl(id: string) {
    return `${window.location.origin}/s/${id}`;
  }

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 34, fontWeight: 900, letterSpacing: -0.5 }}>
              My Sites
            </h1>
            <p style={{ marginTop: 6, opacity: 0.85 }}>
              These are the websites you saved from <b>/builder</b>.
            </p>
          </div>

          <a href="/builder" style={linkButtonStyle}>
            Back to Builder
          </a>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center" }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name / prompt / id..."
            style={inputStyle}
          />
          <button onClick={load} style={btnStyle}>
            Refresh
          </button>
        </div>

        {loading ? (
          <div style={{ marginTop: 18, opacity: 0.85 }}>Loading…</div>
        ) : err ? (
          <div style={{ marginTop: 18, color: "rgba(255,255,255,0.95)" }}>
            <div
              style={{
                background: "rgba(0,0,0,0.22)",
                padding: 12,
                borderRadius: 12,
                border: border,
              }}
            >
              <b>Error:</b> {err}
              <div style={{ marginTop: 8, opacity: 0.85 }}>
                Make sure <code>/api/sites/list</code> works (try opening it in the browser).
              </div>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ marginTop: 18, opacity: 0.85 }}>
            No saved sites yet. Go to{" "}
            <a href="/builder" style={{ color: "white" }}>
              /builder
            </a>{" "}
            and click <b>Save Website</b>.
          </div>
        ) : (
          <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
            {filtered.map((r) => (
              <div key={r.id} style={cardStyle}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "flex-start",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 900, fontSize: 16 }}>
                      {r.name?.trim() ? r.name : "Untitled Site"}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4, wordBreak: "break-word" }}>
                      id: {r.id}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>
                      {r.created_at ? new Date(r.created_at).toLocaleString() : ""}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {/* OPEN = private viewer (your app) */}
                    <a href={`/site/${r.id}`} style={btnSmallStyle}>
                      Open
                    </a>

                    {/* COPY HTML */}
                    <button
                      onClick={() => {
                        if (!r.html) return alert("This row has no html saved.");
                        navigator.clipboard.writeText(r.html);
                        alert("HTML copied!");
                      }}
                      style={btnSmallStyle}
                    >
                      Copy HTML
                    </button>

                    {/* COPY SHARE LINK */}
                    <button
                      onClick={() => {
                        const url = shareUrl(r.id);
                        navigator.clipboard.writeText(url);
                        alert(`Share link copied!\n\n${url}`);
                      }}
                      style={btnSmallStyle}
                    >
                      Copy Share Link
                    </button>
                  </div>
                </div>

                {r.prompt ? (
                  <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9, whiteSpace: "pre-wrap" }}>
                    <b>Prompt:</b> {r.prompt}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const border = "1px solid rgba(255,255,255,0.18)";

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: "28px 18px 60px",
  background:
    "radial-gradient(1200px 600px at 20% 0%, rgba(255,255,255,0.18), transparent 60%), linear-gradient(135deg, rgb(124,58,237) 0%, rgb(109,40,217) 35%, rgb(91,33,182) 100%)",
  color: "white",
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
};

const cardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.12)",
  border,
  borderRadius: 16,
  padding: 14,
  boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: "12px 12px",
  borderRadius: 12,
  border,
  outline: "none",
  background: "rgba(0,0,0,0.18)",
  color: "white",
};

const btnStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  border,
  background: "rgba(255,255,255,0.14)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const btnSmallStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border,
  background: "rgba(255,255,255,0.14)",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
  textDecoration: "none",
};

const linkButtonStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border,
  background: "rgba(255,255,255,0.14)",
  color: "white",
  fontWeight: 900,
  textDecoration: "none",
  whiteSpace: "nowrap",
};


