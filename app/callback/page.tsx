"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return createClient(url, anon);
}

export default function CallbackPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const next = useMemo(() => sp.get("next") || "/billing", [sp]);
  const [msg, setMsg] = useState("Finishing sign-in…");

  useEffect(() => {
    const run = async () => {
      try {
        const supabase = getSupabase();
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!data?.session) {
          setMsg("No session found. Redirecting to login…");
          router.replace(`/login?next=${encodeURIComponent(next)}`);
          return;
        }
        router.replace(next);
      } catch (e: any) {
        setMsg(e?.message || "Callback failed. Redirecting…");
        router.replace(`/login?next=${encodeURIComponent(next)}`);
      }
    };
    run();
  }, [router, next]);

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ fontFamily: "system-ui", opacity: 0.85 }}>{msg}</div>
    </main>
  );
}


