"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

export default function AuthCallbackPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/billing";

  useEffect(() => {
    // Keep this super simple: your /callback handles session check
    router.replace(`/callback?next=${encodeURIComponent(next)}`);
  }, [router, next]);

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ fontFamily: "system-ui", opacity: 0.85 }}>Redirecting…</div>
    </main>
  );
}


