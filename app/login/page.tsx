"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export default function LoginPage() {
  const supabase = useMemo(() => createClientComponentClient(), []);
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/builder";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }

    // go to builder
    router.replace(next);
    router.refresh();
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <div style={styles.title}>ForgeSite</div>
        <div style={styles.sub}>Sign in to access the Builder.</div>

        <form onSubmit={onSubmit} style={{ marginTop: 16 }}>
          <div style={{ display: "grid", gap: 10 }}>
            <input
              style={styles.input}
              placeholder="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              style={styles.input}
              placeholder="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div style={styles.error}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <button type="submit" disabled={busy} style={styles.btnPrimary}>
              {busy ? "Signing in..." : "Sign in"}
            </button>

            <a href="/signup" style={styles.btnSecondary}>
              Need an account?
            </a>

            <a href="/" style={styles.btnSecondary}>
              Back home
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 18,
    background:
      "radial-gradient(1200px 600px at 30% 20%, rgba(255,255,255,0.18), transparent 60%), linear-gradient(135deg, #6b2bd8, #4b1aa6)",
  },
  card: {
    width: "min(760px, 100%)",
    borderRadius: 18,
    padding: 22,
    background: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.16)",
    boxShadow: "0 18px 60px rgba(0,0,0,0.25)",
    color: "white",
  },
  title: { fontSize: 56, fontWeight: 900, lineHeight: 1 },
  sub: { opacity: 0.9, marginTop: 6 },
  input: {
    width: "100%",
    padding: "14px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.20)",
    background: "rgba(0,0,0,0.16)",
    color: "white",
    outline: "none",
  },
  btnPrimary: {
    padding: "12px 14px",
    borderRadius: 12,
    border: 0,
    background: "rgba(255,255,255,0.92)",
    color: "#3a0d88",
    fontWeight: 800,
    cursor: "pointer",
  },
  btnSecondary: {
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.22)",
    background: "rgba(255,255,255,0.12)",
    color: "white",
    fontWeight: 700,
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  error: {
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    background: "rgba(255,0,0,0.18)",
    border: "1px solid rgba(255,0,0,0.25)",
  },
};









