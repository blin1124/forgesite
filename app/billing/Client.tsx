"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type EntitlementResp = {
  ok?: boolean;
  active?: boolean;
  status?: string | null;
  current_period_end?: string | null;
  error?: string;
};

export default function BillingClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const next = useMemo(() => sp.get("next") || "/builder", [sp]);

  const [email, setEmail] = useState<string | null>(null);
  const [token, setToken] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string>("");

  // ✅ New: entitlement status
  const [checkingEntitlement, setCheckingEntitlement] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          setEmail(null);
          setToken("");
          setIsSubscribed(false);
        } else {
          const em = data?.session?.user?.email ?? null;
          const tk = data?.session?.access_token ?? "";
          setEmail(em);
          setToken(tk);

          // ✅ If signed in, check entitlement once
          if (tk) {
            setCheckingEntitlement(true);
            try {
              const r = await fetch("/api/entitlement", {
                method: "GET",
                headers: { authorization: `Bearer ${tk}` },
                cache: "no-store",
              });

              const j = (await r.json()) as EntitlementResp;

              if (r.ok && j?.active === true) {
                setIsSubscribed(true);
              } else {
                setIsSubscribed(false);
              }
            } catch {
              setIsSubscribed(false);
            } finally {
              setCheckingEntitlement(false);
            }
          }
        }
      } catch {
        setEmail(null);
        setToken("");
        setIsSubscribed(false);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  async function goCheckout() {
    setMsg("");

    try {
      // If not signed in, send to login and back to billing
      if (!token) {
        router.push(
          `/login?next=${encodeURIComponent(
            `/billing?next=${encodeURIComponent(next)}`
          )}`
        );
        return;
      }

      // ✅ If already subscribed, just go where they were headed
      if (isSubscribed) {
        router.push(next);
        return;
      }

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ next }),
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          `Checkout response not JSON (${res.status}). ${text.slice(0, 180)}`
        );
      }

      if (!res.ok) throw new Error(data?.error || `Checkout failed (${res.status})`);
      if (!data?.url) throw new Error("Checkout succeeded but returned no url");

      window.location.href = data.url;
    } catch (e: any) {
      setMsg(e?.message || "Checkout failed");
    }
  }

  const showSubscribeLine = !loading && !checkingEntitlement && !isSubscribed;

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
        position: "relative",
      }}
    >
      {/* ✅ bottom-left legal links */}
      <div
        style={{
          position: "fixed",
          left: 18,
          bottom: 16,
          display: "flex",
          gap: 12,
          alignItems: "center",
          zIndex: 50,
        }}
      >
        <button onClick={() => router.push("/terms")} style={linkBtn}>
          Terms
        </button>
        <span style={{ opacity: 0.65 }}>•</span>
        <button onClick={() => router.push("/privacy")} style={linkBtn}>
          Privacy
        </button>
      </div>

      <div
        style={{
          width: "min(760px, 92vw)",
          background: "rgba(255,255,255,0.12)",
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: 16,
          padding: 18,
          boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>ForgeSite Billing</h1>

        {/* ✅ Only show this line for users who are NOT subscribed */}
        {showSubscribeLine ? (
          <p style={{ marginTop: 8, opacity: 0.9 }}>
            Subscribe to access the Builder. After payment you’ll return to: <b>{next}</b>
          </p>
        ) : (
          <div style={{ height: 10 }} />
        )}

        <div style={{ marginTop: 12, opacity: 0.9, fontSize: 14 }}>
          {loading ? (
            "Checking session…"
          ) : email ? (
            <>
              Signed in as <b>{email}</b>
            </>
          ) : (
            "Not signed in (login first)."
          )}
        </div>

        {/* ✅ Green subscribed message */}
        {!loading && !checkingEntitlement && isSubscribed ? (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 12,
              background: "rgba(34, 197, 94, 0.18)",
              border: "1px solid rgba(34, 197, 94, 0.45)",
              color: "rgba(255,255,255,0.95)",
              fontWeight: 900,
            }}
          >
            ✅ You’re already subscribed
          </div>
        ) : null}

        {/* Optional: show entitlement check state */}
        {!loading && email && checkingEntitlement ? (
          <div style={{ marginTop: 12, opacity: 0.9, fontSize: 13 }}>
            Checking subscription…
          </div>
        ) : null}

        {msg ? (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 12,
              background: "rgba(185, 28, 28, .25)",
              border: "1px solid rgba(185, 28, 28, .5)",
              whiteSpace: "pre-wrap",
            }}
          >
            {msg}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          <button
            onClick={goCheckout}
            disabled={loading || checkingEntitlement}
            style={primaryBtn}
          >
            {loading || checkingEntitlement
              ? "Loading…"
              : isSubscribed
              ? "Go to Builder"
              : "Subscribe"}
          </button>

          <button
            onClick={() =>
              router.push(
                `/login?next=${encodeURIComponent(
                  `/billing?next=${encodeURIComponent(next)}`
                )}`
              )
            }
            style={secondaryBtn}
          >
            Back to login
          </button>

          <button onClick={() => router.push(next)} style={secondaryBtn}>
            Go to Builder
          </button>
        </div>
      </div>
    </main>
  );
}

const primaryBtn: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.92)",
  color: "rgb(85, 40, 150)",
  fontWeight: 900,
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "rgba(255,255,255,0.14)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const linkBtn: React.CSSProperties = {
  padding: "6px 8px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(0,0,0,0.18)",
  color: "rgba(255,255,255,0.92)",
  fontWeight: 800,
  fontSize: 12,
  cursor: "pointer",
};









