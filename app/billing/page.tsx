"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";

export default function BillingPage() {
  const searchParams = useSearchParams();
  const next = searchParams?.get("next") || "/builder";

  const [loading, setLoading] = React.useState<null | "checkout" | "portal">(null);
  const [error, setError] = React.useState<string | null>(null);

  async function goCheckout() {
    try {
      setError(null);
      setLoading("checkout");

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ next }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(json?.error || "Checkout error");
        return;
      }

      if (json?.url) {
        window.location.href = json.url;
      } else {
        setError("Checkout did not return a URL.");
      }
    } catch (e: any) {
      setError(e?.message || "Checkout error");
    } finally {
      setLoading(null);
    }
  }

  async function goPortal() {
    try {
      setError(null);
      setLoading("portal");

      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ next }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(json?.error || "Portal error");
        return;
      }

      if (json?.url) {
        window.location.href = json.url;
      } else {
        setError("Portal did not return a URL.");
      }
    } catch (e: any) {
      setError(e?.message || "Portal error");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="min-h-[calc(100vh-0px)] w-full flex items-center justify-center bg-black">
      {/* Background gradient (matches your screenshot vibe) */}
      <div className="fixed inset-0 bg-gradient-to-b from-black via-zinc-950 to-black opacity-95" />

      <div className="relative z-10 w-full max-w-xl px-4">
        <div className="rounded-2xl border border-white/10 bg-zinc-950/60 backdrop-blur p-6 shadow-xl">
          <div className="mb-4">
            <h1 className="text-xl font-semibold text-white">ForgeSite Billing</h1>
            <p className="mt-1 text-sm text-white/70">
              Subscribe to access the Builder. Public share links (<code className="text-white/70">/s/&lt;id&gt;</code>) stay public.
            </p>
          </div>

          {error ? (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              onClick={goCheckout}
              disabled={loading !== null}
              className="w-full sm:w-auto rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-60"
            >
              {loading === "checkout" ? "Opening checkout..." : "Subscribe ($29.99/mo)"}
            </button>

            <button
              onClick={goPortal}
              disabled={loading !== null}
              className="w-full sm:w-auto rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-60"
            >
              {loading === "portal" ? "Opening portal..." : "Manage subscription / cancel"}
            </button>

            {/* ✅ TERMS BUTTON → PDF in /public */}
            <a
              href="/Forgesite_Terms_of_Service.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto text-center rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
            >
              Terms &amp; Conditions
            </a>
          </div>

          {/* Optional: Privacy link (remove if you only want Terms) */}
          <div className="mt-4 text-xs text-white/60">
            <a
              href="/Forgesite_Privacy_Policy_No_Contact.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-white"
            >
              Privacy Policy
            </a>
            <span className="mx-2">•</span>
            <span>After paying, you’ll be sent back and unlocked automatically.</span>
          </div>
        </div>
      </div>
    </div>
  );
}



