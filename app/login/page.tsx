"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const nextUrl = sp.get("next") || "/builder";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // If already signed in, leave login immediately
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      if (data.session) router.replace(nextUrl);
    })();
    return () => {
      alive = false;
    };
  }, [supabase, router, nextUrl]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMsg(error.message);
        return;
      }

      // IMPORTANT: allow cookie write to settle, then go
      router.replace(nextUrl);
      router.refresh();
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
        background:
          "radial-gradient(1200px 600px at 50% 20%, #8b5cf6 0%, #5b21b6 55%, #3b0764 100%)",
        padding: 18,
      }}
    >
      <div style={{ width: "min(920px, 96vw)" }}>
        <h1 style={{ color: "white", fontSize: 64, margin: 0, fontWeight: 900 }}>
          ForgeSite
        </h1>
        <p style={{ color: "rgba(255,255,255,.85)", marginTop: 6 }}>
          Sign in to access the Builder.
        </p>

        <div
          style={{
            marginTop: 18,
            borderRadius: 16,
            background: "rgba(255,255,255,.08)",
            border: "1px solid rgba(255,255,255,.12)",
            padding: 18,
            boxShadow: "0 10px 40px rgba(0,0,0,.25)",
            maxWidth: 760,
          }}
        >
          <div style={{ color: "white", fontWeight: 800, fontSize: 26 }}>
            Sign in
          </div>
          <div style={{ color: "rgba(255,255,255,.8)", marginTop: 4 }}>
            Email + password only.
          </div>

          <form onSubmit={onSubmit} style={{ marginTop: 14 }}>
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
              style={{ ...inputStyle, marginTop: 10 }}
            />

            {msg && (
              <div style={{ marginTop: 10, color: "#fecaca" }}>{msg}</div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button disabled={busy} style={primaryBtn}>
                {busy ? "Signing in..." : "Sign in"}
              </button>

              <button
                type="button"
                onClick={() => router.push("/signup")}
                style={secondaryBtn}
              >
                Need an account?
              </button>

              <button
                type="button"
                onClick={() => router.push("/")}
                style={secondaryBtn}
              >
                Back home
              </button>
            </div>

            <div
              style={{
                marginTop: 10,
                color: "rgba(255,255,255,.75)",
                fontSize: 13,
              }}
            >
              After sign-in you’ll go to: <b>{nextUrl}</b>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,.16)",
  background: "rgba(0,0,0,.15)",
  color: "white",
  padding: "12px 14px",
  fontSize: 16,
  outline: "none",
};

const primaryBtn: React.CSSProperties = {
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,.20)",
  background: "rgba(255,255,255,.92)",
  color: "#3b0764",
  padding: "10px 14px",
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,.18)",
  background: "rgba(255,255,255,.08)",
  color: "white",
  padding: "10px 14px",
  fontWeight: 700,
  cursor: "pointer",
};











