"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!url || !anon) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return createClient(url, anon);
}

export default function BuilderClient() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [entitled, setEntitled] = useState<boolean | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const supabase = getSupabase();
        const { data } = await supabase.auth.getSession();

        const userEmail = data?.session?.user?.email ?? null;
        const token = data?.session?.access_token ?? null;

        setEmail(userEmail);

        if (!userEmail || !token) {
          router.push("/login?next=%2Fbuilder");
          return;
        }

        // ✅ check entitlement
        const res = await fetch("/api/entitlement", {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        });

        const json = await res.json().catch(() => ({}));
        const ok = !!json?.entitled;

        setEntitled(ok);

        if (!ok) {
          router.push("/billing?next=%2Fbuilder");
          return;
        }
      } catch {
        router.push("/login?next=%2Fbuilder");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [router]);

  if (loading) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        Loading…
      </main>
    );
  }

  if (entitled === false) return null;

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 24,
        color: "white",
        background:
          "radial-gradient(1200px 600px at 20% 0%, rgba(255,255,255,0.18), transparent 60%), linear-gradient(135deg, rgb(124,58,237) 0%, rgb(109,40,217) 35%, rgb(91,33,182) 100%)",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
      }}
    >
      <div style={{ width: "min(1100px, 94vw)", margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>Builder</h1>
            <div style={{ marginTop: 6, opacity: 0.9, fontSize: 14 }}>
              {email ? (
                <>
                  Signed in as <b>{email}</b>
                </>
              ) : null}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => router.push("/domain")} style={secondaryBtn}>
              Connect a Custom Domain →
            </button>

            <button onClick={() => router.push("/billing?next=%2Fbuilder")} style={secondaryBtn}>
              Billing
            </button>
          </div>
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.12)",
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: 16,
            padding: 18,
            boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>Your Builder UI</h2>
          <p style={{ marginTop: 8, opacity: 0.9 }}>
            Put your existing builder components here.
          </p>

          <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => router.push("/sites")} style={primaryBtn}>
              My Sites
            </button>

            <button onClick={() => router.push("/templates")} style={secondaryBtn}>
              Templates
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

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

