"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function CallbackClient() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    // Keep it simple: after returning from Stripe or OAuth, go to billing (or next)
    const next = sp.get("next") || "/billing";
    router.replace(next);
  }, [router, sp]);

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ fontFamily: "ui-sans-serif, system-ui", opacity: 0.8 }}>Redirecting…</div>
    </main>
  );
}
