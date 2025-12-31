"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return createClient(url, anon);
}

export default function BillingClient() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const supabase = getSupabase();
        const { data } = await supabase.auth.getSession();
        const userEmail = data?.session?.user?.email ?? null;
        setEmail(userEmail);

        if (!data?.session?.user) {
          router.replace(`/login?next=${encodeURIComponent("/billing")}`);
        }
      } catch {
        router.replace(`/login?next=${encodeURIComponent("/billing")}`);
      }
    })();
  }, [router]);

  async function goCheckout() {
    setMsg(null);
    setBusy(true);
    try {
      const res = await fetch("/api/checkout", { method: "POST" });
      const text = await res.text();

      // Expect JSON like: { url: "https://checkout.stripe.com/..." }
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(text || "Checkout failed");
      }

      if (!res.ok) throw new Error(data?.error || "Checkout failed");
      if (!data?.url) throw new Error("No checkout URL returned");

      window.location.href = data.url;
    } catch (e: any) {
      setMsg(e?.message || "Checkout failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0 }}>Billing</h1>
      <p style={{ marginTop: 8, opacity: 0.8 }}>
        You must subscribe before you can access the Builder.
      </p>

      <div
        style={{
          marginTop: 16,
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 14,
          padding: 16,
        }}
      >
        <div style={{ fontWeight: 700 }}>Signed in as</div>
        <div style={{ marginTop: 6 }}>{email ?? "…"}</div>

        {msg ? (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 12,
              background: "rgba(185, 28, 28, .10)",
              border: "1px solid rgba(185, 28, 28, .25)",
            }}
          >
            {msg}
          </div>
        ) : null}

        <button
          onClick={goCheckout}
          disabled={busy}
          style={{
            marginTop: 14,
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.12)",
            background: "black",
            color: "white",
            fontWeight: 900,
            cursor: "pointer",
            width: "100%",
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? "Redirecting…" : "Subscribe"}
        </button>

        <button
          onClick={() => router.push("/")}
          style={{
            marginTop: 10,
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.12)",
            background: "white",
            color: "black",
            fontWeight: 800,
            cursor: "pointer",
            width: "100%",
          }}
        >
          Back
        </button>
      </div>
    </main>
  );
}
