"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function SuccessClient() {
  const router = useRouter();
  const search = useSearchParams();
  const [msg, setMsg] = useState("Finalizing your subscription…");

  useEffect(() => {
    const run = async () => {
      const sessionId = search.get("session_id") || "";
      const next = search.get("next") || "/builder";

      if (!sessionId) {
        setMsg("Missing session_id. Sending you to billing…");
        router.replace(`/billing?next=${encodeURIComponent(next)}`);
        return;
      }

      try {
        // Confirm will upsert entitlements row
        const res = await fetch("/api/stripe/confirm", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setMsg(data?.error || "Could not finalize subscription. Sending you to billing…");
          router.replace(`/billing?next=${encodeURIComponent(next)}`);
          return;
        }

        setMsg("Unlocked! Redirecting…");
        router.replace(next);
      } catch {
        setMsg("Network error. Sending you to billing…");
        router.replace(`/billing?next=${encodeURIComponent(next)}`);
      }
    };

    run();
  }, [router, search]);

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
          width: "min(760px, 92vw)",
          background: "rgba(255,255,255,0.12)",
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: 16,
          padding: 18,
          boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
          textAlign: "center",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>Success</h1>
        <p style={{ marginTop: 10, opacity: 0.9 }}>{msg}</p>
      </div>
    </main>
  );
}










