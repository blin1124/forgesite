"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type EntitlementResp = {
  ok?: boolean;
  active?: boolean;
  status?: string | null;
  current_period_end?: string | null;
  has_row?: boolean;
  error?: string;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: true, json: JSON.parse(text), text };
  } catch {
    return { ok: false, json: null, text };
  }
}

export default function BillingClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const next = useMemo(() => sp.get("next") || "/builder", [sp]);
  const sessionId = useMemo(() => sp.get("session_id") || "", [sp]);

  const [email, setEmail] = useState<string | null>(null);
  const [token, setToken] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string>("");

  const [checkingEntitlement, setCheckingEntitlement] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  // extra debug so you can see why it says “not subscribed”
  const [entDebug, setEntDebug] = useState<EntitlementResp | null>(null);

  async function checkEntitlement(tk: string) {
    setCheckingEntitlement(true);
    try {
      const r = await fetch("/api/entitlement", {
        method: "GET",
        headers: { authorization: `Bearer ${tk}` },
        cache: "no-store",
      });

      const data = (await r.json().catch(() => ({}))) as EntitlementResp;

      setEntDebug(data);

      if (r.ok && data?.active === true) {
        setIsSubscribed(true);
        return true;
      } else {
        setIsSubscribed(false);
        return false;
      }
    } catch (e: any) {
      setEntDebug({ ok: false, active: false, status: "inactive", error: e?.message || "entitlement crashed" });
      setIsSubscribed(false);
      return false;
    } finally {
      setCheckingEntitlement(false);
    }
  }

  // ✅ NEW: if we have a Stripe session_id in URL, try to finalize it
  async function finalizeIfReturningFromStripe(tk: string) {
    if (!sessionId) return false;

    setMsg("Finalizing your subscription…");
    try {
      const r = await fetch("/api/stripe/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });

      const { ok: isJson, json, text } = await safeJson(r);

      if (!r.ok) {
        setMsg(
          (isJson ? json?.error : text) ||
            `Could not finalize subscription (${r.status}).`
        );
        return false;
      }

      // now re-check entitlement
      const active = await checkEntitlement(tk);
      if (active) {
        setMsg("Unlocked ✅ Redirecting…");
        router.replace(next);
        return true;
      }

      setMsg("Payment received, but access is still syncing. Try again in a moment.");
      return false;
    } catch (e: any) {
      setMsg(e?.message || "Finalize failed");
      return false;
    }
  }

  useEffect(() => {
    const run = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          setEmail(null);
          setToken("");
          setIsSubscribed(false);
          return;
        }

        const em = data?.session?.user?.email ?? null;
        const tk = data?.session?.access_token ?? "";

        setEmail(em);
        setToken(tk);

        if (!tk) {
          setIsSubscribed(false);
          return;
        }

        // ✅ If returning from Stripe, try finalize first (then redirect)
        const finalized = await finalizeIfReturningFromStripe(tk);
        if (finalized) return;

        // otherwise just check entitlement normally
        await checkEntitlement(tk);
      } catch {
        setEmail(null);
        setToken("");
        setIsSubscribed(false);
      } finally {
        setLoading(false);
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  async function goCheckout() {
    setMsg("");

    try {
      if (!token) {
        router.push(
          `/login?next=${encodeURIComponent(
            `/billing?next=${encodeURIComponent(next)}`
          )}`
        );
        return;
      }

      // ✅ If already subscribed, go where they were headed
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
      {/* bottom-left legal links */}
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
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>
          ForgeSite Billing
        </h1>

        {showSubscribeLine ? (
          <p style={{ marginTop: 8, opacity: 0.9 }}>
            Subscribe to access the Builder. After payment you’ll return to:{" "}
            <b>{next}</b>
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
              background: "rgba(0,0,0,0.22)",
              border: "1px solid rgba(255,255,255,0.14)",
              whiteSpace: "pre-wrap",
            }}
          >
            {msg}
          </div>
        ) : null}

        {/* optional debug */}
        {!loading && entDebug ? (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 12,
              background: "rgba(0,0,0,0.18)",
              border: "1px solid rgba(255,255,255,0.14)",
              fontSize: 12,
              opacity: 0.95,
              whiteSpace: "pre-wrap",
            }}
          >
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Entitlement debug</div>
            {`active=${String(entDebug.active ?? false)}
status=${String(entDebug.status ?? "inactive")}
has_row=${String(entDebug.has_row ?? false)}
current_period_end=${String(entDebug.current_period_end ?? null)}
error=${entDebug.error ?? ""}`}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          <button onClick={goCheckout} disabled={loading || checkingEntitlement} style={primaryBtn}>
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

          {/* ✅ Only show direct “Go to Builder” when subscribed */}
          {isSubscribed ? (
            <button onClick={() => router.push(next)} style={secondaryBtn}>
              Go to Builder
            </button>
          ) : null}

          {/* ✅ Manual retry */}
          {!loading && token ? (
            <button onClick={() => checkEntitlement(token)} style={secondaryBtn}>
              Retry access
            </button>
          ) : null}
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










