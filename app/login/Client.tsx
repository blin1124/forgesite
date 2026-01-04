"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, anon);
}

export default function LoginClient() {
  const router = useRouter();
  const search = useSearchParams();

  const next = search.get("next") || "/builder";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ If already logged in, redirect immediately
  useEffect(() => {
    const check = async () => {
      const supabase = getSupabase();
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        router.replace(next);
      }
    };
    check();
  }, [router, next]);

  async function login() {
    setLoading(true);
    setMsg("");

    try {
      const supabase = getSupabase();

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMsg(error.message);
        return;
      }

      // ✅ IMPORTANT: wait for cookie write
      await new Promise((r) => setTimeout(r, 200));

      router.replace(next);
    } catch {
      setMsg("Login failed");
    } finally {
      setLoading(false);
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
      }}
    >
      <div
        style={{
          width: 420,
          background: "rgba(255,255,255,0.12)",
          borderRadius: 16,
          padding: 20,
        }}
      >
        <h1 style={{ fontSize: 26, fontWeight: 900 }}>Log in</h1>
        <p style={{ opacity: 0.85 }}>After login, you’ll go to: <b>{next}</b></p>

        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={input}
        />
        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={input}
        />

        {msg && (
          <div style={{ marginTop: 10, color: "#fecaca" }}>{msg}</div>
        )}

        <button onClick={login} disabled={loading} style={btn}>
          {loading ? "Signing in…" : "Log in"}
        </button>
      </div>
    </main>
  );
}

const input: React.CSSProperties = {
  width: "100%",
  padding: 12,
  marginTop: 10,
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.3)",
  background: "rgba(255,255,255,0.15)",
  color: "white",
};

const btn: React.CSSProperties = {
  width: "100%",
  padding: 12,
  marginTop: 14,
  borderRadius: 12,
  fontWeight: 900,
  background: "white",
  color: "rgb(91,33,182)",
  border: "none",
  cursor: "pointer",
};


