"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

function LoginInner() {
  const router = useRouter();
  const sp = useSearchParams();

  // ✅ safe: computed from search params (client-only), and wrapped in Suspense
  const next = sp.get("next") || "/builder";

  const [email, setEmail] = useState<string>("");
  const [busy, setBusy] = useState<string>("");
  const [debug, setDebug] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();
        setEmail(data?.session?.user?.email || "");
      } catch {
        setEmail("");
      }
    })();
  }, []);

  function continueToApp() {
    router.push(next);
  }

  async function signInWithGoogle() {
    setBusy("");
    setDebug("");

    try {
      setBusy("Redirecting to Google…");

      const supabase = createSupabaseBrowserClient();
      const origin = window.location.origin;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });

      if (error) throw error;
    } catch (e: any) {
      setBusy("");
      setDebug(e?.message || "Sign-in failed");
    }
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
      <div style={{ width: "min(860px, 100%)" }}>
        <div style={{ fontSize: 54, fontWeight: 900, lineHeight: 1.05 }}>
          ForgeSite
        </div>
        <div style={{ opacity: 0.9, marginTop: 8 }}>
          Sign in to access the Builder.
        </div>

        <section style={{ ...card, marginTop: 18 }}>
          {email ? (
            <>
              <div style={{ fontSize: 20, fontWeight: 900 }}>You’re signed in</div>
              <div style={{ opacity: 0.9, marginTop: 6 }}>
                Signed in as <b>{email}</b>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                <button style={primaryBtn} onClick={continueToApp}>
                  Continue →
                </button>
                <button
                  style={secondaryBtn}
                  onClick={async () => {
                    const supabase = createSupabaseBrowserClient();
                    await supabase.auth.signOut();
                    setEmail("");
                  }}
                >
                  Log out
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 20, fontWeight: 900 }}>Sign in</div>
              <div style={{ opacity: 0.9, marginTop: 6 }}>
                Use Google to sign in. You’ll come back automatically.
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                <button style={primaryBtn} onClick={signInWithGoogle}>
                  Continue with Google →
                </button>
                <button style={secondaryBtn} onClick={() => router.push("/")}>
                  Back home
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
  // ✅ This prevents build/prerender crash with useSearchParams
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








