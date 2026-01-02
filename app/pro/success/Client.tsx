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
  const next = useMemo(() => sp.get("next") || "/builder", [sp]);

  const [msg, setMsg] = useState<string>("Finalizing your subscription…");

  useEffect(() => {
    const run = async () => {
      try {
        if (!sessionId) {
          setMsg("Missing session_id from Stripe. Returning to billing…");
          setTimeout(() => router.replace("/billing?next=%2Fbuilder"), 1200);
          return;
        }

        const supabase = getSupabase();
        const { data: sess } = await supabase.auth.getSession();
        const token = sess?.session?.access_token;

        if (!token) {
          setMsg("You are not signed in. Please log in, then we’ll finish activation.");
          setTimeout(() => router.replace(`/login?next=${encodeURIComponent(`/pro/success?session_id=${sessionId}&next=${next}`)}`), 1200);
          return;
        }

        const res = await fetch("/api/stripe/sync", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ session_id: sessionId }),
        });

        const text = await res.text();
        let json: any = null;
        try {
          json = JSON.parse(text);
        } catch {
          // keep as text
        }

        if (!res.ok) {
          const errMsg = json?.error || text || "Activation failed";
          setMsg(errMsg);
          return;
        }

        setMsg("Subscription activated. Redirecting to Builder…");
        setTimeout(() => router.replace(next), 800);
      } catch (e: any) {
        setMsg(e?.message || "Activation failed");
      }
    };

    run();
  }, [router, sessionId, next]);

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
          width: "min(720px, 92vw)",
          background: "rgba(255,255,255,0.12)",
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: 16,
          padding: 18,
          boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>Payment Success</h1>
        <p style={{ marginTop: 8, opacity: 0.9 }}>{msg}</p>

        <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => router.replace(next)}
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
            onClick={() => router.replace("/billing?next=%2Fbuilder")}
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


