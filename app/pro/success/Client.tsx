"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!url || !anon) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return createClient(url, anon);
}

export default function SuccessClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const next = useMemo(() => sp.get("next") || "/builder", [sp]);

  const [msg, setMsg] = useState("Finalizing your subscription…");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const supabase = getSupabase();

        // Wait up to ~25 seconds for webhook to write entitlement
        const start = Date.now();
        while (!cancelled && Date.now() - start < 25000) {
          const { data: auth } = await supabase.auth.getUser();
          const user = auth?.user;

          if (!user) {
            setMsg("You’re not logged in. Sending you to login…");
            router.push(`/login?next=${encodeURIComponent(next)}`);
            return;
          }

          const { data: ent } = await supabase
            .from("entitlements")
            .select("status")
            .eq("user_id", user.id)
            .maybeSingle();

          if (ent?.status === "active" || ent?.status === "trialing") {
            setMsg("Subscription active — sending you to the Builder…");
            router.push(next);
            return;
          }

          setMsg("Payment received — waiting for activation (few seconds)…");
          await new Promise((r) => setTimeout(r, 2000));
        }

        setMsg("Still activating. Go to Billing and click Subscribe again if needed.");
      } catch {
        setMsg("Activation check failed. Go to Billing and try again.");
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [router, next]);

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ maxWidth: 560, width: "100%", fontFamily: "system-ui" }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>ForgeSite</h1>
        <p style={{ marginTop: 10, opacity: 0.8 }}>{msg}</p>
        <p style={{ marginTop: 10, opacity: 0.7, fontSize: 13 }}>
          If it doesn’t unlock within ~30 seconds, open <code>/billing</code> and try again.
        </p>
      </div>
    </main>
  );
}





