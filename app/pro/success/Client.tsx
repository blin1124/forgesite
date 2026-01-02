"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!url || !anon) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return createClient(url, anon);
}

export default function SuccessClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const sessionId = useMemo(() => sp.get("session_id") || "", [sp]);

  const [msg, setMsg] = useState("Finalizing your subscription…");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        if (!sessionId) {
          setErr("Missing Stripe session_id");
          setMsg("Something went wrong.");
          return;
        }

        const supabase = getSupabase();
        const { data } = await supabase.auth.getSession();
        const token = data?.session?.access_token;

        if (!token) {
          router.push(`/login?next=${encodeURIComponent(`/pro/success?session_id=${sessionId}`)}`);
          return;
        }

        // ✅ Sync Stripe → entitlements
        const res = await fetch("/api/stripe/sync", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({ session_id: sessionId }),
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || "Sync failed");

        setMsg("Subscription activated. Redirecting to Builder…");

        // small delay so user sees message
        setTimeout(() => router.push("/builder"), 600);
      } catch (e: any) {
        setErr(e?.message || "Failed to activate subscription");
        setMsg("Activation failed.");
      }
    };

    run();
  }, [router, sessionId]);

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
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
      }}
    >
      <div
        style={{
          width: "min(640px, 92vw)",
          background: "rgba(255,255,255,0.12)",
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: 16,
          padding: 18,
          boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>Success</h1>
        <p style={{ marginTop: 10, opacity: 0.9 }}>{msg}</p>

        {err ? (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 12,
              background: "rgba(185, 28, 28, .25)",
              border: "1px solid rgba(185, 28, 28, .5)",
            }}
          >
            {err}
          </div>
        ) : null}

        <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => router.push("/builder")}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.92)",
              color: "rgb(85, 40, 150)",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Go to Builder
          </button>

          <button
            onClick={() => router.push("/billing")}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.25)",
              background: "rgba(255,255,255,0.14)",
              color: "white",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Back to Billing
          </button>
        </div>
      </div>
    </main>
  );
}
