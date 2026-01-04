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
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ maxWidth: 560, textAlign: "center" }}>
        <h1 style={{ fontSize: 28, marginBottom: 10 }}>Success</h1>
        <p style={{ opacity: 0.85 }}>{msg}</p>
      </div>
    </main>
  );
}











