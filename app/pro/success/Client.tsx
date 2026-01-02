"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function ProSuccessClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const sessionId = sp.get("session_id") || "";
  const next = useMemo(() => sp.get("next") || "/builder", [sp]);

  const [msg, setMsg] = useState("Finalizing your subscription…");

  useEffect(() => {
    const run = async () => {
      try {
        if (!sessionId) {
          setMsg("Missing session_id. Returning to billing…");
          router.replace(`/billing?next=${encodeURIComponent(next)}`);
          return;
        }

        const res = await fetch("/api/stripe/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || "Sync failed");
        }

        setMsg("Subscription activated. Redirecting…");

        // Give middleware a moment to see the entitlement row
        setTimeout(() => {
          router.replace(next);
        }, 400);
      } catch (e: any) {
        setMsg(e?.message || "Something went wrong. Returning to billing…");
        setTimeout(() => {
          router.replace(`/billing?next=${encodeURIComponent(next)}`);
        }, 800);
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
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
      }}
    >
      <div style={{ maxWidth: 520 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>ForgeSite</h1>
        <p style={{ marginTop: 10, opacity: 0.8 }}>{msg}</p>
        <p style={{ marginTop: 8, opacity: 0.55, fontSize: 13 }}>
          If you get stuck here, go back to <a href={`/billing?next=${encodeURIComponent(next)}`}>Billing</a>.
        </p>
      </div>
    </main>
  );
}



