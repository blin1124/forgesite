"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

function LoginInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/builder";

  const supabase = createClientComponentClient();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  // If already signed in, go straight to builder
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session) router.replace(next);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSignIn() {
    setBusy("Signing in…");
    setErrorMsg("");

    const e = email.trim();
    if (!e) {
      setBusy("");
      setErrorMsg("Email is required.");
      return;
    }
    if (!password) {
      setBusy("");
      setErrorMsg("Password is required.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: e,
      password,
    });

    if (error) {
      setBusy("");
      setErrorMsg(error.message);
      return;
    }

    setBusy("");
    router.replace(next);
  }

  async function onSignUp() {
    setBusy("Creating account…");
    setErrorMsg("");

    const e = email.trim();
    if (!e) {
      setBusy("");
      setErrorMsg("Email is required.");
      return;
    }
    if (!password) {
      setBusy("");
      setErrorMsg("Password is required.");
      return;
    }

    // IMPORTANT:
    // If Supabase Email Confirmations are ON, signup will NOT create a session immediately.
    // We handle both cases: attempt sign-in; if confirmations are required we show message.
    const origin = window.location.origin;

    const { error: signUpErr } = await supabase.auth.signUp({
      email: e,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (signUpErr) {
      setBusy("");
      setErrorMsg(signUpErr.message);
      return;
    }

    // Try immediate sign-in (works if email confirmations are OFF)
    setBusy("Signing in…");
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: e,
      password,
    });

    if (!signInErr) {
      setBusy("");
      router.replace(next);
      return;
    }

    // Confirmations are ON → no session until email confirmed
    setBusy("");
    setErrorMsg(
      "Account created. Check your email to confirm your account, then come back and sign in.\n\n" +
        "If you want signup to go straight into the Builder, turn OFF email confirmations in Supabase → Auth → Providers → Email."
    );
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
        <div style={{ fontSize: 62, fontWeight: 900, lineHeight: 1.05 }}>
          ForgeSite
        </div>
        <div style={{ opacity: 0.9, marginTop: 8 }}>
          Sign in to access the Builder.
        </div>

        <section style={{ ...card, marginTop: 18 }}>
          <div style={{ fontSize: 20, fontWeight: 900 }}>
            {mode === "signin" ? "Sign in" : "Create account"}
          </div







