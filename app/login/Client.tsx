"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function LoginClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const next = useMemo(() => sp.get("next") || "/builder", [sp]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [debug, setDebug] = useState("");

  async function onLogin() {
    setError("");
    setDebug("");
    setBusy(true);

    try {
      const supabase = createSupabaseBrowserClient();

      setDebug("Signing in…");

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw new Error(error.message);

      // Confirm we now have a session (cookie-based)
      const { data: s } = await supabase.auth.getSession();
      if (!s?.session?.access_token) {
        throw new Error("Login succeeded but no session found. Cookie/session not set.");
      }

      setDebug(`Signed in. Redirecting to ${next}…`);

      // Try Next router first
      router.replace(next);
      router.refresh();

      // Hard redirect fallback — kills “stays on login” forever
      setTimeout(() => {
        window.location.assign(next);
      }, 200);
    } catch (e: any) {
      setError(e?.message || "Login failed");
      setDebug("");
    } finally {
      setBusy(false);
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
          "radial-gradient(1200px 600px at 20% 0%, rgba(255,255,255,0.18), transparent 60%), linear-gradient(135deg, rgb(17,24,39) 0%, rgb(0,0,0) 55%, rgb(31,41,55) 100%)",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
      }}
    >
      <div
        style={{
          width: "min(520px, 92vw)",
          background: "rgba(255,255,255,0.10)",
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: 16,
          padding: 18,
          boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>Log in to ForgeSite</h1>
        <p style={{ marginTop: 8, opacity: 0.85 }}>Continue to: {next}</p>

        {error ? (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 12,
              background: "rgba(185, 28, 28, .25)",
              border: "1px solid rgba(185, 28, 28, .5)",
              whiteSpace: "pre-wrap",
            }}
          >
            {error}
          </div>
        ) : null}

        {debug ? (
          <div
            style={{
              marginTop: 12,
              padding: 10,
              borderRadius: 12,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.14)",
              fontSize: 13,
              opacity: 0.9,
              whiteSpace: "pre-wrap",
            }}
          >
            {debug}
          </div>
        ) : null}

        <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            style={inputStyle}
            autoComplete="email"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
            style={inputStyle}
            autoComplete="current-password"
          />

          <button
            onClick={onLogin}
            disabled={busy || !email.trim() || password.length < 6}
            style={{
              ...buttonStyle,
              opacity: busy || !email.trim() || password.length < 6 ? 0.6 : 1,
              background: "rgba(16,185,129,0.80)",
              border: "1px solid rgba(16,185,129,0.65)",
              color: "black",
            }}
          >
            {busy ? "Logging in…" : "Log in"}
          </button>

          <a
            href={`/signup?next=${encodeURIComponent(next)}`}
            style={{
              textAlign: "center",
              marginTop: 6,
              color: "white",
              opacity: 0.9,
              textDecoration: "underline",
              fontSize: 13,
            }}
          >
            Need an account? Create one
          </a>
        </div>
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  outline: "none",
  background: "rgba(0,0,0,0.25)",
  color: "white",
};

const buttonStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.14)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};












