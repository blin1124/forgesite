"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function DomainClient() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [domain, setDomain] = useState("");
  const [savedDomain, setSavedDomain] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const run = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();
        setEmail(data?.session?.user?.email || "");
      } catch {
        setEmail("");
      }

      // local-only (won’t touch DB/RLS; won’t break anything)
      try {
        const d = localStorage.getItem("forgesite:last_domain") || "";
        if (d) {
          setDomain(d);
          setSavedDomain(d);
        }
      } catch {}
    };
    run();
  }, []);

  const cleanDomain = useMemo(() => domain.trim().toLowerCase(), [domain]);

  function isValidDomain(d: string) {
    if (!d) return false;
    if (d.includes("http://") || d.includes("https://")) return false;
    if (d.includes("/") || d.includes(" ")) return false;
    if (!d.includes(".")) return false;
    return /^[a-z0-9.-]+$/.test(d);
  }

  function saveLocal() {
    setMsg("");
    const d = cleanDomain;

    if (!isValidDomain(d)) {
      setMsg("Please enter a domain like: yourbusiness.com (no https://)");
      return;
    }

    try {
      localStorage.setItem("forgesite:last_domain", d);
      setSavedDomain(d);
      setMsg("Saved ✅ (local)");
      setTimeout(() => setMsg(""), 1200);
    } catch {
      setMsg("Could not save locally (browser blocked storage).");
    }
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
          <div style={{ fontSize: 40, fontWeight: 900, lineHeight: 1 }}>Domain</div>
          <div style={{ opacity: 0.9 }}>
            Signed in as <b>{email || "unknown"}</b>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button style={topBtn} onClick={() => router.push("/builder")}>← Back to Builder</button>
          <button style={topBtn} onClick={() => router.push("/billing")}>Billing</button>
        </div>
      </header>

      <div style={{ marginTop: 14, maxWidth: 980 }}>
        <section style={card}>
          <div style={{ fontSize: 22, fontWeight: 900 }}>Custom domain (what customers expect)</div>
          <div style={{ opacity: 0.9, marginTop: 6, lineHeight: 1.35 }}>
            When you finish designing your site, you can connect your own domain (like <b>yourbusiness.com</b>). You’ll
            buy the domain from a registrar, then connect it inside ForgeSite.
          </div>

          <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
            <div style={{ fontWeight: 900 }}>Your domain</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="yourbusiness.com"
                style={{ ...input, minWidth: 320, flex: 1 }}
              />
              <button style={primaryBtn} onClick={saveLocal}>Save</button>
            </div>

            {savedDomain ? (
              <div style={{ opacity: 0.9, fontSize: 13 }}>
                Saved domain: <b>{savedDomain}</b>
              </div>
            ) : null}

            {msg ? (
              <div style={{ marginTop: 8, padding: 10, borderRadius: 12, background: "rgba(0,0,0,0.25)" }}>
                {msg}
              </div>
            ) : null}
          </div>

          <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
            <div style={{ fontWeight: 900 }}>Steps</div>

            <div style={{ opacity: 0.95, lineHeight: 1.45 }}>
              <div><b>Step 1:</b> Buy a domain from GoDaddy, IONOS, Namecheap, etc.</div>
              <div><b>Step 2:</b> In <b>Vercel → Project → Settings → Domains</b>, add your domain.</div>
              <div><b>Step 3:</b> Vercel will show the exact DNS records you must add (A/CNAME). Copy them into your registrar.</div>
              <div><b>Step 4:</b> DNS can take a bit to update (often minutes, sometimes longer).</div>
            </div>

            <div
              style={{
                marginTop: 8,
                padding: 12,
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(0,0,0,0.16)",
              }}
            >
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Important</div>
              <div style={{ opacity: 0.92, fontSize: 13, lineHeight: 1.35 }}>
                Don’t guess the Apex IP. Use the one Vercel shows under your project’s Domain settings.
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
              <a href="https://www.godaddy.com/domains" target="_blank" rel="noreferrer" style={linkBtn}>
                Buy on GoDaddy →
              </a>
              <a href="https://www.ionos.com/domains" target="_blank" rel="noreferrer" style={linkBtn}>
                Buy on IONOS →
              </a>
              <a href="https://www.namecheap.com/domains/" target="_blank" rel="noreferrer" style={linkBtn}>
                Buy on Namecheap →
              </a>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.12)",
  border: "1px solid rgba(255,255,255,0.18)",
  borderRadius: 16,
  padding: 16,
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
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
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

const linkBtn: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "rgba(255,255,255,0.14)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};



