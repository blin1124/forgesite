"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function DomainClient() {
  const router = useRouter();

  const [email, setEmail] = useState("");

  const [apexDomain, setApexDomain] = useState("");
  const [wwwDomain, setWwwDomain] = useState("");

  const [savedApex, setSavedApex] = useState("");
  const [savedWww, setSavedWww] = useState("");

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

      // local-only for now (won’t touch DB/RLS; won’t break anything)
      try {
        const a = localStorage.getItem("forgesite:customer_domain_apex") || "";
        const w = localStorage.getItem("forgesite:customer_domain_www") || "";
        if (a) setApexDomain(a);
        if (w) setWwwDomain(w);
        setSavedApex(a);
        setSavedWww(w);
      } catch {}
    };
    run();
  }, []);

  const apexClean = useMemo(() => cleanDomain(apexDomain), [apexDomain]);
  const wwwClean = useMemo(() => cleanDomain(wwwDomain), [wwwDomain]);

  function cleanDomain(d: string) {
    return String(d || "")
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")
      .replace(/\s+/g, "");
  }

  function isValidDomain(d: string) {
    if (!d) return false;
    if (d.includes("/")) return false;
    if (d.includes(" ")) return false;
    if (!d.includes(".")) return false;
    return /^[a-z0-9.-]+$/.test(d);
  }

  function setDefaultWwwFromApex(a: string) {
    const x = cleanDomain(a);
    if (!isValidDomain(x)) return;
    // if they typed www already, keep it
    if (wwwDomain.trim()) return;
    setWwwDomain(`www.${x}`);
  }

  function saveLocal() {
    setMsg("");

    const a = apexClean;
    const w = wwwClean;

    if (!isValidDomain(a)) {
      setMsg("Please enter a domain like: yourbusiness.com (no https://)");
      return;
    }

    // www is optional but recommended
    const wFinal = w && isValidDomain(w) ? w : `www.${a}`;

    try {
      localStorage.setItem("forgesite:customer_domain_apex", a);
      localStorage.setItem("forgesite:customer_domain_www", wFinal);

      setSavedApex(a);
      setSavedWww(wFinal);

      setMsg("Saved ✅");
      setTimeout(() => setMsg(""), 1400);
    } catch {
      setMsg("Could not save (browser blocked storage).");
    }
  }

  function markDone() {
    setMsg("");
    if (!savedApex) {
      setMsg("Save your domain first.");
      return;
    }

    // Placeholder for later:
    // - trigger verification check
    // - show “Connected ✅” once verified
    setMsg("Perfect — next we’ll verify your DNS automatically (coming next). ✅");
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
          <div style={{ fontSize: 22, fontWeight: 900 }}>Connect your custom domain</div>
          <div style={{ opacity: 0.92, marginTop: 6, lineHeight: 1.4 }}>
            When you’re done building your website, you can connect a domain you own (like <b>yourbusiness.com</b>) so
            visitors can find your site easily.
          </div>

          <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
            <div style={{ fontWeight: 900 }}>Your domain</div>

            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <input
                  value={apexDomain}
                  onChange={(e) => setApexDomain(e.target.value)}
                  onBlur={() => setDefaultWwwFromApex(apexDomain)}
                  placeholder="yourbusiness.com"
                  style={{ ...input, minWidth: 320, flex: 1 }}
                />
                <button style={primaryBtn} onClick={saveLocal}>Save</button>
              </div>

              <input
                value={wwwDomain}
                onChange={(e) => setWwwDomain(e.target.value)}
                placeholder="www.yourbusiness.com (recommended)"
                style={{ ...input, minWidth: 320 }}
              />
            </div>

            {(savedApex || savedWww) ? (
              <div style={{ opacity: 0.92, fontSize: 13, lineHeight: 1.35 }}>
                <div>Saved:</div>
                <div><b>Apex:</b> {savedApex || "(not saved)"}</div>
                <div><b>WWW:</b> {savedWww || "(not saved)"}</div>
              </div>
            ) : null}

            {msg ? (
              <div style={{ marginTop: 8, padding: 10, borderRadius: 12, background: "rgba(0,0,0,0.25)" }}>
                {msg}
              </div>
            ) : null}
          </div>

          <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
            <div style={{ fontWeight: 900 }}>What happens next</div>

            <div style={{ opacity: 0.95, lineHeight: 1.5 }}>
              <div><b>Step 1:</b> Buy a domain from a registrar (GoDaddy, IONOS, Namecheap, etc.).</div>
              <div><b>Step 2:</b> In your registrar’s DNS settings, you’ll add the records ForgeSite gives you.</div>
              <div><b>Step 3:</b> Once the DNS records are saved, ForgeSite will verify the connection automatically.</div>
              <div style={{ marginTop: 6, opacity: 0.9 }}>
                DNS updates can take a bit (often minutes, sometimes longer).
              </div>
            </div>

            <div
              style={{
                padding: 12,
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(0,0,0,0.16)",
              }}
            >
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Your DNS records (coming next)</div>
              <div style={{ opacity: 0.92, fontSize: 13, lineHeight: 1.35 }}>
                Next we’ll display the exact DNS records right here (A/CNAME), and verify automatically.
                For now, this page is the customer flow + UI.
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button style={secondaryBtn} onClick={markDone}>
                I’ve added my DNS records →
              </button>

              <button style={secondaryBtn} onClick={() => router.push("/builder")}>
                Back to Builder
              </button>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
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





