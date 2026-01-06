"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!url || !anon) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return createClient(url, anon);
}

export default function BillingClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const next = useMemo(() => sp.get("next") || "/builder", [sp]);

  const [email, setEmail] = useState<string | null>(null);
  const [token, setToken] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    const run = async () => {
      try {
        const supabase = getSupabase();
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          setEmail(null);
          setToken("");
        } else {
          setEmail(data?.session?.user?.email ?? null);
          setToken(data?.session?.access_token ?? "");
        }
      } catch {
        setEmail(null);
        setToken("");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  async function goCheckout() {
    setMsg("");
    try {
      // if no token, force login first
      if (!token) {
        router.push(`/login?next=${encodeURIComponent(`/billing?next=${encodeURIComponent(next)}`)}`);
        return;
      }

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ next }),
      });

      // IMPORTANT: if middleware ever redirects, this will be HTML, so read text first.
      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Checkout response not JSON (${res.status}). ${text.slice(0, 180)}`);
      }

      if (!res.ok) throw new Error(data?.error || `Checkout failed (${res.status})`);
      if (!data?.url) throw new Error("Checkout succeeded but returned no url");

      window.location.href = data.url;
    } catch (e: any) {
      setMsg(e?.message || "Checkout failed");
    }
  }

  return (
    <main style={page}>
      <div style={card}>
        <h1 style={h1}>ForgeSite Billing</h1>

        <p style={p}>
          Subscribe to access the Builder. After payment you’ll return to: <b>{next}</b>
        </p>

        <div style={statusLine}>
          {loading ? (
            "Checking session…"
          ) : email ? (
            <>
              Signed in as <b>{email}</b>
            </>
          ) : (
            "Not signed in (login first)."
          )}
        </div>

        {msg ? <div style={errorBox}>{msg}</div> : null}

        {/* MAIN BUTTONS (keep these in the middle) */}
        <div style={mainButtons}>
          <button onClick={goCheckout} disabled={loading} style={primaryBtn}>
            {loading ? "Loading…" : "Subscribe"}
          </button>

          <button onClick={() => router.push(next)} style={secondaryBtn}>
            Go to Builder
          </button>

          <button
            onClick={() =>
              router.push(`/login?next=${encodeURIComponent(`/billing?next=${encodeURIComponent(next)}`)}`)
            }
            style={secondaryBtn}
          >
            Back to login
          </button>
        </div>

        {/* TERMS/PRIVACY SMALL FOOTER (moved out of the middle) */}
        <div style={footer}>
          <button onClick={() => router.push("/terms")} style={footerLinkBtn}>
            Terms
          </button>
          <span style={dot}>•</span>
          <button onClick={() => router.push("/privacy")} style={footerLinkBtn}>
            Privacy
          </button>
        </div>
      </div>
    </main>
  );
}

/* ================== styles ================== */

const page: React.CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: 24,
  color: "white",
  background:
    "radial-gradient(1200px 600px at 20% 0%, rgba(255,255,255,0.18), transparent 60%), linear-gradient(135deg, rgb(124,58,237) 0%, rgb(109,40,217) 35%, rgb(91,33,182) 100%)",
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
};

const card: React.CSSProperties = {
  width: "min(760px, 92vw)",
  background: "rgba(255,255,255,0.12)",
  border: "1px solid rgba(255,255,255,0.18)",
  borderRadius: 16,
  padding: 18,
  boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
};

const h1: React.CSSProperties = {
  margin: 0,
  fontSize: 28,
  fontWeight: 900,
};

const p: React.CSSProperties = {
  marginTop: 8,
  opacity: 0.9,
};

const statusLine: React.CSSProperties = {
  marginTop: 12,
  opacity: 0.9,
  fontSize: 14,
};

const mainButtons: React.CSSProperties = {
  display: "flex",
  gap: 10,
  marginTop: 16,
  flexWrap: "wrap",
};

const footer: React.CSSProperties = {
  marginTop: 22,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: 8,
  opacity: 0.85,
};

const footerLinkBtn: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: "rgba(255,255,255,0.9)",
  fontWeight: 800,
  cursor: "pointer",
  fontSize: 13,
  textDecoration: "underline",
  padding: 4,
};

const dot: React.CSSProperties = {
  opacity: 0.7,
  fontSize: 13,
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

const errorBox: React.CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 12,
  background: "rgba(185, 28, 28, .25)",
  border: "1px solid rgba(185, 28, 28, .5)",
  whiteSpace: "pre-wrap",
};









