"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

function supabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, anon, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
}

async function getEntitlement() {
  // This assumes you already have /api/entitlement working in your project.
  // It should return JSON like: { active: true } or { active: false }
  const res = await fetch("/api/entitlement", { method: "GET", cache: "no-store" });
  if (!res.ok) return { active: false };
  return (await res.json()) as { active?: boolean };
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = useMemo(() => searchParams.get("next") || "/builder", [searchParams]);

  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function finishRedirect() {
    // If they are not subscribed, force billing.
    const ent = await getEntitlement();
    if (!ent?.active) {
      router.replace("/billing");
      return;
    }
    router.replace(next);
  }

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    try {
      const supabase = supabaseBrowser();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      await finishRedirect();
    } catch (err: any) {
      setMsg(err?.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setMsg(null);
    setLoading(true);

    try {
      const supabase = supabaseBrowser();
      const origin =
        typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });

      if (error) throw error;
      // Redirect happens via OAuth
    } catch (err: any) {
      setMsg(err?.message || "Google sign-in failed.");
      setLoading(false);
    }
  }

  // ✅ Hydration fix: don’t SSR-render the form at all
  if (!mounted) return null;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "radial-gradient(circle at top, #101827 0%, #05070d 60%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 16px",
        color: "white",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 18,
          padding: 24,
          boxShadow: "0 18px 60px rgba(0,0,0,0.45)",
        }}
      >
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>Log in to ForgeSite</h1>
        <div style={{ opacity: 0.8, fontSize: 14, marginBottom: 16 }}>
          Continue to: <b>{next}</b>
        </div>

        <button
          onClick={onGoogle}
          disabled={loading}
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.10)",
            color: "white",
            fontWeight: 800,
            cursor: loading ? "not-allowed" : "pointer",
            marginBottom: 14,
          }}
        >
          Continue with Google
        </button>

        <div style={{ opacity: 0.65, fontSize: 12, margin: "10px 0 14px" }}>
          Or log in with email
        </div>

        <form onSubmit={onLogin}>
          <label style={{ display: "block", fontSize: 12, opacity: 0.9, marginBottom: 6 }}>
            Email
          </label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
            required
            style={{
              width: "100%",
              padding: "12px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(0,0,0,0.35)",
              color: "white",
              marginBottom: 12,
            }}
          />

          <label style={{ display: "block", fontSize: 12, opacity: 0.9, marginBottom: 6 }}>
            Password
          </label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
            required
            style={{
              width: "100%",
              padding: "12px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(0,0,0,0.35)",
              color: "white",
              marginBottom: 14,
            }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 12,
              border: "none",
              background: loading ? "#2e2e2e" : "#0ea371",
              color: "black",
              fontWeight: 900,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Working..." : "Log in"}
          </button>
        </form>

        {msg && (
          <div
            style={{
              marginTop: 12,
              padding: 10,
              borderRadius: 12,
              background: "rgba(255,0,0,0.12)",
              border: "1px solid rgba(255,0,0,0.25)",
              color: "white",
              fontSize: 13,
            }}
          >
            {msg}
          </div>
        )}

        <div style={{ marginTop: 14, fontSize: 13, opacity: 0.85 }}>
          Need an account?{" "}
          <Link href="/signup" style={{ color: "white", fontWeight: 800, textDecoration: "underline" }}>
            Create one
          </Link>
        </div>
      </div>
    </main>
  );
}



