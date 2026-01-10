"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

function LoginInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/builder";

  const [sessionEmail, setSessionEmail] = useState<string>("");

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");

  const [busy, setBusy] = useState<string>("");
  const [debug, setDebug] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();
        setSessionEmail(data?.session?.user?.email || "");
      } catch {
        setSessionEmail("");
      }
    })();
  }, []);

  function goNext() {
    router.push(next);
  }

  async function signInPassword() {
    setBusy("");
    setDebug("");

    const e = email.trim();
    if (!e) return setDebug("Email is required.");
    if (!password) return setDebug("Password is required.");

    try {
      setBusy("Signing in…");
      const supabase = createSupabaseBrowserClient();

      const { error } = await supabase.auth.signInWithPassword({
        email: e,
        password,
      });

      if (error) throw error;

      setBusy("");
      goNext();
    } catch (err: any) {
      setBusy("");
      setDebug(err?.message || "Sign-in failed");
    }
  }

  async function signUpPassword() {
    setBusy("");
    setDebug("");

    const e = email.trim();
    if (!e) return setDebug("Email is required.");
    if (!password) return setDebug("Password is required.");

    try {
      setBusy("Creating account…");
      const supabase = createSupabaseBrowserClient();

      // If you require email confirmation, Supabase will email them.
      // If not, it signs them in immediately.
      const { error } = await supabase.auth.signUp({
        email: e,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });

      if (error) throw error;

      setBusy("Account created ✅");
      setTimeout(() => setBusy(""), 900);
    } catch (err: any) {
      setBusy("");
      setDebug(err?.message || "Sign-up failed");
    }
  }

  async function signInWithGoogle() {
    setBusy("");
    setDebug("");

    try {
      setBusy("Redirecting to Google…");
      const supabase = createSupabaseBrowserClient();
      const origin = window.location.origin;

      // ✅ MUST point to a real route handler: /auth/callback
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });

      if (error) throw error;
    } catch (err: any) {
      setBusy("");
      setDebug(err?.message || "Google sign-in failed");
    }
  }

  async function logout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    setSessionEmail("");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 18,
        color: "white",
        background:
          "radial-gradient(1200px 600px at 20% 0%, rgba(255,255,255,0.18), transparent 60%), linear-gradient(135deg, rgb(124,58,237) 0%, rgb(109,40,217) 35%, rgb(91,33,182) 100%)",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
        display: "grid",
        placeItems: "center",
      }}
    >
      <div style={{ width: "min(920px, 100%)" }}>
        <div style={{ fontSize: 62, fontWeight: 900, lineHeight: 1.05 }}>ForgeSite</div>
        <div style={{ opacity: 0.9, marginTop: 8 }}>Sign in to access the Builder.</div>

        <section style={{ ...card, marginTop: 18 }}>
          {sessionEmail ? (
            <>
              <div style={{ fontSize: 20, fontWeight: 900 }}>You’re signed in</div>
              <div style={{ opacity: 0.9, marginTop: 6 }}>
                Signed in as <b>{sessionEmail}</b>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                <button style={primaryBtn} onClick={goNext}>
                  Continue →
                </button>
                <button style={secondaryBtn} onClick={logout}>
                  Log out
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 20, fontWeight: 900 }}>
                {mode === "signin" ? "Sign in" : "Create account"}
              </div>
              <div style={{ opacity: 0.9, marginTop: 6 }}>
                Use email/password or Google. You’ll return automatically.
              </div>

              <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  autoComplete="email"
                  style={input}
                />
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  type="password"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  style={input}
                />
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                {mode === "signin" ? (
                  <button style={primaryBtn} onClick={signInPassword}>
                    Sign in →
                  </button>
                ) : (
                  <button style={primaryBtn} onClick={signUpPassword}>
                    Create account →
                  </button>
                )}

                <button style={secondaryBtn} onClick={signInWithGoogle}>
                  Continue with Google →
                </button>

                <button
                  style={ghostBtn}
                  onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
                >
                  {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
                </button>
              </div>
            </>
          )}

          {busy ? (
            <div style={{ marginTop: 12, padding: 10, borderRadius: 12, background: "rgba(0,0,0,0.25)" }}>
              {busy}
            </div>
          ) : null}

          {debug ? (
            <div
              style={{
                marginTop: 12,
                padding: 10,
                borderRadius: 12,
                background: "rgba(185, 28, 28, .25)",
                border: "1px solid rgba(185, 28, 28, .5)",
              }}
            >
              <div style={{ fontWeight: 900 }}>Debug</div>
              <div style={{ whiteSpace: "pre-wrap", fontSize: 12, opacity: 0.95 }}>{debug}</div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

export default function LoginPage() {
  // ✅ prevents build/prerender crash with useSearchParams
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh" }} />}>
      <LoginInner />
    </Suspense>
  );
}

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.12)",
  border: "1px solid rgba(255,255,255,0.18)",
  borderRadius: 18,
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

const ghostBtn: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px dashed rgba(255,255,255,0.35)",
  background: "transparent",
  color: "rgba(255,255,255,0.95)",
  fontWeight: 900,
  cursor: "pointer",
};








