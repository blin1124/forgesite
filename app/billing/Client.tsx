"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!url || !anon) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return createClient(url, anon);
}

export default function BillingClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/builder";

  const [email, setEmail] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const supabase = getSupabase();
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        setEmail(data?.session?.user?.email ?? null);
        setAccessToken(data?.session?.access_token ?? null);
      } catch {
        setEmail(null);
        setAccessToken(null);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  async function goCheckout() {
    setMsg(null);

    try {
      if (!accessToken) {
        setMsg("Not signed in. Please log in again.");
        router.push(`/login?next=${encodeURIComponent("/billing?next=" + encodeURIComponent(next))}`);
        return;
      }

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const text = await res.text();

      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        // if server sent plain text/html, show it
        throw new Error(text || "Checkout failed");
      }

      if (!res.ok) throw new Error(data?.error || "Checkout failed");
      if (!data?.url) throw new Error("Missing checkout URL");

      window.location.href = data.url;
    } catch (e: any) {
      setMsg(e?.message || "Checkout failed");
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        color: "white",
        background:
          "radial-gradient(1200px 600px at 20% 0%, rgba(255,255,255,0.18), transparent 60%), linear-gradient(135deg, rgb(124,58,237) 0%, rgb(109,40,217) 35%, rgb(91,33,182) 100%)",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
      }}
    >
      <div
        style={{
          width: "min(720px, 92vw)",
          background: "rgba(255,255,255,0.12)",
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: 16,
          padding: 18,
          boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>Billing</h1>
        <p style={{ marginTop: 8, opacity: 0.9 }}>
          Subscribe to access the Builder. After payment you’ll return to: <b>{next}</b>
        </p>

        <div style={{ marginTop: 12, opacity: 0.9, fontSize: 14 }}>
          {loading ? "Checking session…" : email ? <>Signed in as <b>{email}</b></> : "Not signed in (login first)."}
        </div>

        {msg ? (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 12,
              background: "rgba(185, 28, 28, .25)",
              border: "1px solid rgba(185, 28, 28, .5)",
            }}
          >
            {msg}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          <button onClick={goCheckout} style={primaryBtn}>
            Subscribe
          </button>

          <button onClick={() => router.push("/terms")} style={{ ...secondaryBtn, textDecoration: "underline" }}>
            Terms
          </button>

          <button onClick={() => router.push("/privacy")} style={{ ...secondaryBtn, textDecoration: "underline" }}>
            Privacy
          </button>

          <button onClick={() => router.push("/login?next=/billing")} style={secondaryBtn}>
            Back to login
          </button>
        </div>
      </div>
    </main>
  );
}

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
  fontWeight: 800,
  cursor: "pointer",
};








