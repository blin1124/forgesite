"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function Client() {
  const sp = useSearchParams();
  const next = useMemo(() => sp.get("next") || "/builder", [sp]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSignIn() {
    setBusy(true);
    setMsg(null);

    try {
      const supabase = supabaseBrowser();

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMsg(error.message);
        return;
      }

      // ✅ Confirm session exists client-side
      const session = data?.session;
      if (!session) {
        // Fallback: fetch session from client
        const { data: s2 } = await supabase.auth.getSession();
        if (!s2.session) {
          setMsg("Signed in, but session did not persist. Check Supabase URL/Anon and browser storage.");
          return;
        }
      }

      // ✅ Force a full navigation so middleware runs with cookies
      window.location.assign(next);
    } catch (e: any) {
      setMsg(e?.message || "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 18,
        background:
          "radial-gradient(1200px 600px at 50% 0%, rgba(255,255,255,0.12), rgba(0,0,0,0)), linear-gradient(180deg, #7c3aed 0%, #5b21b6 100%)",
        color: "white",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
      }}
    >
      <div style={{ width: "min(720px, 94vw)" }}>
        <div style={{ fontSize: 72, fontWeight: 900, letterSpacing: -1, lineHeight: 1, textAlign: "center" }}>
          ForgeSite
        </div>
        <div style={{ textAlign: "center", opacity: 0.9, marginTop: 10 }}>
          Sign in to access the Builder.
        </div>

        <div
          style={{
            marginTop: 26,
            padding: 22,
            borderRadius: 18,
            background: "rgba(255,255,255,0.10)",
            border: "1px solid rgba(255,255,255,0.18)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          }}
        >
          <div style={{ fontSize: 24, fontWeight: 800 }}>Sign in</div>
          <div style={{ opacity: 0.85, marginTop: 4 }}>Email + password only.</div>

          <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              style={inputStyle}
            />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              type="password"
              autoComplete="current-password"
              style={inputStyle}
            />
          </div>

          {msg ? (
            <div
              style={{
                marginTop: 12,
                padding: 10,
                borderRadius: 12,
                background: "rgba(0,0,0,0.25)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              {msg}
            </div>
          ) : null}

          <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={onSignIn}
              disabled={busy || !email || !password}
              style={primaryBtn}
            >
              {busy ? "Signing in..." : "Sign in"}
            </button>

            <a href="/signup" style={secondaryBtn as any}>
              Need an account?
            </a>

            <a href="/" style={secondaryBtn as any}>
              Back home
            </a>
          </div>

          <div style={{ marginTop: 10, opacity: 0.75 }}>
            After sign-in you’ll go to: <b>{next}</b>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(0,0,0,0.18)",
  color: "white",
  outline: "none",
  fontSize: 16,
};

const primaryBtn: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.22)",
  background: "rgba(255,255,255,0.92)",
  color: "#4c1d95",
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.08)",
  color: "white",
  fontWeight: 700,
  textDecoration: "none",
};








