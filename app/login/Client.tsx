"use client";

import React, { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function LoginClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const next = useMemo(() => sp.get("next") || "/builder", [sp]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const supabase = createSupabaseBrowserClient();

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setError(error.message);
        return;
      }

      // Important: ensure session exists
      const hasSession = !!data?.session;
      if (!hasSession) {
        // fallback fetch session
        const { data: sess } = await supabase.auth.getSession();
        if (!sess?.session) {
          setError("Signed in, but no session was created. Check Supabase auth settings.");
          return;
        }
      }

      // ✅ This is what you're missing if it "just stays on login"
      router.replace(next);
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Login failed");
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
        padding: 18,
        color: "white",
        background:
          "radial-gradient(1200px 600px at 20% 0%, rgba(255,255,255,0.18), transparent 60%), linear-gradient(135deg, rgb(124,58,237) 0%, rgb(109,40,217) 35%, rgb(91,33,182) 100%)",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
      }}
    >
      <section style={{ width: "min(760px, 92vw)" }}>
        <h1 style={{ fontSize: 64, lineHeight: 1, margin: 0, fontWeight: 900 }}>ForgeSite</h1>
        <p style={{ marginTop: 10, opacity: 0.9 }}>Sign in to access the Builder.</p>

        <div
          style={{
            marginTop: 18,
            background: "rgba(255,255,255,0.12)",
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: 16,
            padding: 18,
            boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Sign in</h2>
          <div style={{ marginTop: 6, opacity: 0.85 }}>Email + password only.</div>

          <form onSubmit={onSubmit} style={{ marginTop: 14, display: "grid", gap: 10 }}>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              inputMode="email"
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

            {error ? (
              <div
                style={{
                  marginTop: 4,
                  padding: "10px 12px",
                  borderRadius: 12,
                  background: "rgba(255,0,0,0.15)",
                  border: "1px solid rgba(255,0,0,0.25)",
                  fontWeight: 700,
                }}
              >
                {error}
              </div>
            ) : null}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
              <button type="submit" disabled={busy} style={primaryBtn}>
                {busy ? "Signing in..." : "Sign in"}
              </button>

              <button
                type="button"
                style={secondaryBtn}
                onClick={() => router.push(`/signup?next=${encodeURIComponent(next)}`)}
                disabled={busy}
              >
                Need an account?
              </button>

              <button type="button" style={secondaryBtn} onClick={() => router.push("/")} disabled={busy}>
                Back home
              </button>
            </div>
          </form>

          <div style={{ marginTop: 12, opacity: 0.75, fontSize: 12 }}>
            After sign-in you’ll go to: <b>{next}</b>
          </div>
        </div>
      </section>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "rgba(0,0,0,0.14)",
  color: "white",
  outline: "none",
  fontSize: 16,
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







