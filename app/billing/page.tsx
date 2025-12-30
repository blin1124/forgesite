"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

export const dynamic = "force-dynamic";

export default function BillingPage() {
  const sp = useSearchParams();
  const next = useMemo(() => sp.get("next") || "/builder", [sp]);

  const [loading, setLoading] = useState<"checkout" | "portal" | "none">("none");
  const [error, setError] = useState<string>("");

  async function goCheckout() {
    try {
      setError("");
      setLoading("checkout");
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Checkout failed");
      window.location.href = data.url;
    } catch (e: any) {
      setError(e.message || "Checkout failed");
      setLoading("none");
    }
  }

  async function goPortal() {
    try {
      setError("");
      setLoading("portal");
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnTo: "/billing" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Portal failed");
      window.location.href = data.url;
    } catch (e: any) {
      setError(e.message || "Portal failed");
      setLoading("none");
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "radial-gradient(circle at top, #111827 0%, #000 70%)",
        padding: 24,
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
          color: "white",
        }}
      >
        <h2 style={{ margin: 0, fontSize: 22 }}>ForgeSite Billing</h2>
        <p style={{ opacity: 0.85, marginTop: 8 }}>
          Subscribe to access the Builder. Public share links (<code>/s/&lt;id&gt;</code>) stay public.
        </p>

        {error ? (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 12,
              background: "rgba(185, 28, 28, .25)",
              border: "1px solid rgba(185, 28, 28, .5)",
            }}
          >
            {error}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
          <button
            onClick={goCheckout}
            disabled={loading !== "none"}
            style={{
              padding: "12px 16px",
              borderRadius: 12,
              border: "none",
              background: "white",
              color: "black",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {loading === "checkout" ? "Redirecting..." : "Subscribe ($29.99/mo)"}
          </button>

          <button
            onClick={goPortal}
            disabled={loading !== "none"}
            style={{
              padding: "12px 16px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,.18)",
              background: "rgba(255,255,255,.06)",
              color: "white",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {loading === "portal" ? "Opening..." : "Manage subscription / cancel"}
          </button>

          <a
            href="/terms"
            style={{
              padding: "12px 16px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,.18)",
              background: "rgba(255,255,255,.06)",
              color: "white",
              fontWeight: 600,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Terms & Conditions
          </a>

          <a
            href="/privacy"
            style={{
              padding: "12px 16px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,.18)",
              background: "rgba(255,255,255,.06)",
              color: "white",
              fontWeight: 600,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Privacy Policy
          </a>
        </div>

        <p style={{ opacity: 0.65, marginTop: 14, fontSize: 13 }}>
          After paying, you’ll be sent back and unlocked automatically.
        </p>
      </div>
    </div>
  );
}



