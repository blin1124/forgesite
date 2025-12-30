"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function Navbar() {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);

        // ✅ Works whether supabaseBrowser is used as object or function,
        // but with the new hybrid export, this is safest/cleanest:
        const { data } = await supabaseBrowser.auth.getSession();

        if (!mounted) return;
        setEmail(data?.session?.user?.email ?? null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    // Optional: keep nav reactive if session changes
    const { data: sub } = supabaseBrowser.auth.onAuthStateChange(() => load());

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  async function signOut() {
    await supabaseBrowser.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        padding: "12px 18px",
        borderBottom: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(17,24,39,0.75)",
        backdropFilter: "blur(10px)",
        color: "white",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/" style={{ color: "white", textDecoration: "none", fontWeight: 900 }}>
          ForgeSite
        </Link>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Link href="/builder" style={navLink}>
            Builder
          </Link>
          <Link href="/sites" style={navLink}>
            Sites
          </Link>
          <Link href="/billing" style={navLink}>
            Billing
          </Link>

          {loading ? (
            <span style={{ opacity: 0.8, fontSize: 13 }}>Loading…</span>
          ) : email ? (
            <>
              <span style={{ opacity: 0.9, fontSize: 13 }}>{email}</span>
              <button onClick={signOut} style={btn}>
                Sign out
              </button>
            </>
          ) : (
            <Link href="/login" style={btnLink}>
              Login
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

const navLink: React.CSSProperties = {
  color: "white",
  textDecoration: "none",
  fontWeight: 700,
  opacity: 0.92,
  fontSize: 14,
};

const btn: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.10)",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
};

const btnLink: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.10)",
  color: "white",
  fontWeight: 800,
  textDecoration: "none",
};






