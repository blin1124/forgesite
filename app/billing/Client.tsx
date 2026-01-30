"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

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
        const supabase = createSupabaseBrowserClient();
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
      if (!token) {
        router.push(
          `/login?next=${encodeURIComponent(
            `/billing?next=${encodeURIComponent(next)}`
          )}`
        );
        return;
      }

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ next }),
      });

      const text = await res.text();
      let data: any = {};

      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          `Checkout response not JSON (${res.status}). ${text.slice(0, 200)}`
        );
      }

      if (!res.ok) throw new Error(data?.error || "Checkout failed");
      if (!data?.url) throw new Error("Stripe did not return a checkout URL");

      window.location.href = data.url;
    } catch (e: any) {
      setMsg(e?.message || "Checkout failed");
    }
  }

  return (
    <main style={page}>
      {/* bottom-left links */}
      <div style={footerLinks}>
        <button onClick={() => router.push("/terms")} style={linkBtn}>
          Terms
        </button>
        <span style={{ opacity: 0.7 }}>•</span>
        <button onClick={() => router.push("/privacy")} style={linkBtn}>
          Privacy
        </button>
      </div>

      <div style={card}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>
          ForgeSite Billing
        </h1>

        <p style={{ marginTop: 8, opacity: 0.9 }}>
          Subscribe to access the Builder. After payment you’ll return to:{" "}
          <b>{next}</b>
        </p>

        <div style={{ marginTop: 12, opacity: 0.9 }}>
          {loading ? (
            "Checking session…"
          ) : email ? (
            <>
              Signed in as <b>{email}</b>
            </>
          ) : (
            "Not signed in."
          )}
        </div>

        {msg && (
          <div style={errorBox}>
            {msg}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
          <button onClick={goCheckout} disabled={loading} style={primaryBtn}>
            {loading ? "Loading…" : "Subscribe"}
          </button>

          <button
            onClick={() =>
              router.push(
                `/login?next=${encodeURIComponent(
                  `/billing?next=${encodeURIComponent(next)}`
                )}`
              )
            }
            style={secondaryBtn}
          >
            Back to login
          </button>

          <button onClick={() => router.push(next)} style={secondaryBtn}>
            Go to Builder
          </button>
        </div>
      </div>
    </main>
  );
}

/* ---------------- styles ---------------- */

const page: React.CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: 24,
  color: "white",
  background:
    "radial-gradient(1200px 600px at 20% 0%, rgba(255,255,255,0.18), transparent 60%), linear-gradient(135deg, rgb(124,58,237) 0%, rgb(109,40,217) 35%, rgb(91,33,182) 100%)",
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
  position: "relative",
};

const card: React.CSSProperties = {
  width: "min(760px, 92vw)",
  background: "rgba(255,255,255,0.12)",
  border: "1px solid rgba(255,255,255,0.18)",
  borderRadius: 16,
  padding: 20,
  boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
};

const footerLinks: React.CSSProperties = {
  position: "fixed",
  left: 18,
  bottom: 16,
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 12px",
  borderRadius: 999,
  background: "rgba(0,0,0,0.25)",
  border: "1px solid rgba(255,255,255,0.15)",
  backdropFilter: "blur(8px)",
};

const linkBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "white",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  padding: 0,
  textDecoration: "underline",
  textUnderlineOffset: 3,
};

const errorBox: React.CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 12,
  background: "rgba(185, 28, 28, 0.25)",
  border: "1px solid rgba(185, 28, 28, 0.5)",
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



