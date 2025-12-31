"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!url || !anon) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return createClient(url, anon);
}

export default function AuthCallbackClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const [msg, setMsg] = useState("Finishing sign-in…");

  useEffect(() => {
    const run = async () => {
      try {
        const supabase = getSupabase();

        // This page often loads right after OAuth redirect; session should now exist
        const { data, error } = await supabase.auth.getSession();
        if (error) throw new Error(error.message);

        if (!data?.session?.user?.id) {
          setMsg("No session found. Redirecting to login…");
          router.replace("/login?next=/billing");
          return;
        }

        // Always send them to billing first
        router.replace("/billing");
      } catch (e: any) {
        setMsg(e?.message || "Auth callback failed. Redirecting to login…");
        router.replace("/login?next=/billing");
      }
    };

    run();
  }, [router, sp]);

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ fontFamily: "ui-sans-serif, system-ui", opacity: 0.8 }}>{msg}</div>
    </main>
  );
}
