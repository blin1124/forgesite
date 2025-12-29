"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

export default function BillingPage() {
  const sp = useSearchParams();
  const next = sp.get("next") || "/builder";
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
          Subscribe to access the Builder. Public share links stay public.
        </p>

        {error && (
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
        )}

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
            {loading === "portal" ? "Opening..." : "Manage subscription"}
          </button>
        </div>

        {/* Legal links */}
        <div
          style={{
            marginTop: 20,
            display: "flex",
            gap: 14,
            flexWrap: "wrap",
            fontSize: 13,
            opacity: 0.85,
          }}
        >
          <Link href="/terms" className="underline">
            Terms of Service
          </Link>
          <Link href="/privacy" className="underline">
            Privacy Policy
          </Link>
        </div>

        <p style={{ opacity: 0.6, marginTop: 12, fontSize: 12 }}>
          By subscribing, you agree to the Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}


