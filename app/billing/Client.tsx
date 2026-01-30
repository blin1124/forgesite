"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

async function readResponse(res: Response) {
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { text, json };
}

async function checkEntitlement(token: string) {
  const res = await fetch("/api/entitlement", {
    method: "GET",
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const { text, json } = await readResponse(res);
  if (!res.ok) return { ok: false, active: false, status: "inactive", error: json?.error || text || "Failed" };

  return {
    ok: true,
    active: Boolean(json?.active),
    status: String(json?.status || "inactive"),
    error: "",
  };
}

export default function BillingClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const next = useMemo(() => sp.get("next") || "/builder", [sp]);

  const [email, setEmail] = useState<string | null>(null);
  const [token, setToken] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string>("");

  // ✅ Step 2B: entitlement state
  const [checkingEntitlement, setCheckingEntitlement] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [entStatus, setEntStatus] = useState<string>("inactive");

  useEffect(() => {
    const run = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          setEmail(null);
          setToken("");
        } else {
          const t = data?.session?.access_token ?? "";
          setEmail(data?.session?.user?.email ?? null);
          setToken(t);

          // ✅ If logged in, check entitlement once
          if (t) {
            setCheckingEntitlement(true);
            const ent = await checkEntitlement(t);
            setIsActive(Boolean(ent.active));
            setEntStatus(ent.status || "inactive");
            setCheckingEntitlement(false);
          }
        }
      } catch {
        setEmail(null);
        setToken("");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  async function goCheckout() {
    setMsg("");

    try {
      // If already active, don't charge again — just go to builder
      if (isActive) {
        router.push(next);
        return;
      }

      // If not signed in, send to login and back to billing
      if (!token) {
        router.push(`/login?next=${encodeURIComponent(`/billing?next=${encodeURIComponent(next)}`)}`);
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
        throw new Error(`Checkout response not JSON (${res.status}). ${text.slice(0, 180)}`);
      }

      if (!res.ok) throw new Error(data?.error || `Checkout failed (${res.status})`);
      if (!data?.url) throw new Error("Checkout succeeded but returned no url");

      window.location.href = data.url;
    } catch (e: any) {
      setMsg(e?.message || "Checkout failed");
    }
  }

  const alreadySubscribed = !loading && !checkingEntitlement && isActive;

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
          width: "min(760px, 92vw)",
          background: "rgba(255,255,255,0.12)",
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: 16,
          padding: 18,
          boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>ForgeSite Billing</h1>

        <p style={{ marginTop: 8, opacity: 0.9 }}>
          Subscribe to access the Builder. After payment you’ll return to: <b>{next}</b>
        </p>

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

        {checkingEntitlement ? (
          <div style={{ marginTop: 12, opacity: 0.9, fontSize: 14 }}>Checking subscription…</div>
        ) : null}

        {alreadySubscribed ? (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 12,
              background: "rgba(16, 185, 129, .18)",
              border: "1px solid rgba(16, 185, 129, .35)",
              whiteSpace: "pre-wrap",
              fontWeight: 900,
            }}
          >
            You’re already subscribed ✅ (status: {entStatus})
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
          <button onClick={goCheckout} disabled={loading || checkingEntitlement} style={primaryBtn}>
            {loading || checkingEntitlement ? "Loading…" : alreadySubscribed ? "Go to Builder" : "Subscribe"}
          </button>

          <button onClick={() => router.push("/terms")} style={secondaryBtn}>
            Terms
          </button>

          <button onClick={() => router.push("/privacy")} style={secondaryBtn}>
            Privacy
          </button>

          <button
            onClick={() => router.push(`/login?next=${encodeURIComponent(`/billing?next=${encodeURIComponent(next)}`)}`)}
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






