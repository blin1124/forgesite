"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function AuthCallbackPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/billing";
  const [msg, setMsg] = useState("Signing you in…");

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        // ✅ supabaseBrowser is a function that returns the client
        const client = supabaseBrowser();

        const { data, error } = await client.auth.getSession();

        if (error) {
          console.error("Callback getSession error:", error.message);
          if (mounted) setMsg("Sign-in failed. Redirecting to login…");
          setTimeout(() => router.replace(`/login?next=${encodeURIComponent(next)}`), 700);
          return;
        }

        // If there is a session, you’re authenticated
        if (data?.session) {
          if (mounted) setMsg("Signed in — redirecting…");
          router.replace(next);
          return;
        }

        // No session yet — send to login
        if (mounted) setMsg("No session found. Redirecting to login…");
        setTimeout(() => router.replace(`/login?next=${encodeURIComponent(next)}`), 700);
      } catch (e: any) {
        console.error("Callback error:", e?.message || e);
        if (mounted) setMsg("Sign-in failed. Redirecting to login…");
        setTimeout(() => router.replace(`/login?next=${encodeURIComponent(next)}`), 700);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [router, next]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "radial-gradient(circle at top, #111827 0%, #000 70%)",
        color: "white",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
      }}
    >
      <div
        style={{
          width: "min(720px, 95vw)",
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,.12)",
          background: "rgba(17, 24, 39, .65)",
          backdropFilter: "blur(10px)",
          padding: 22,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 22 }}>ForgeSite</h2>
        <p style={{ opacity: 0.85, marginTop: 8 }}>{msg}</p>
      </div>
    </div>
  );
}




