"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!url || !anon) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return createClient(url, anon);
}

function isActive(status: string | null, currentPeriodEnd: string | null) {
  if (status !== "active" && status !== "trialing") return false;
  if (!currentPeriodEnd) return true; // some subs may not include it immediately
  return new Date(currentPeriodEnd).getTime() > Date.now();
}

export default function SuccessClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/builder";

  const [msg, setMsg] = useState("Finalizing your subscription…");

  useEffect(() => {
    const run = async () => {
      const supabase = getSupabase();

      // Must be signed in to check entitlements
      const { data: sess } = await supabase.auth.getSession();
      const user = sess?.session?.user;

      if (!user) {
        router.replace(`/login?next=${encodeURIComponent("/pro/success?next=" + next)}`);
        return;
      }

      // Poll for entitlement written by webhook
      const maxMs = 45_000;
      const start = Date.now();

      while (Date.now() - start < maxMs) {
        const { data, error } = await supabase
          .from("entitlements")
          .select("status,current_period_end,updated_at")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data && isActive(data.status ?? null, data.current_period_end ?? null)) {
          router.replace(next);
          return;
        }

        setMsg("Almost done… waiting for Stripe confirmation (webhook) …");
        await new Promise((r) => setTimeout(r, 1500));
      }

      setMsg("Payment succeeded, but access is still locked. This usually means the Stripe webhook didn’t deliver. Check Stripe → Developers → Webhooks → Event deliveries.");
    };

    run();
  }, [router, next]);

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
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>Success</h1>
        <p style={{ marginTop: 10, opacity: 0.9 }}>{msg}</p>
        <p style={{ marginTop: 8, opacity: 0.8, fontSize: 13 }}>
          Destination: <b>{next}</b>
        </p>
      </div>
    </main>
  );
}







