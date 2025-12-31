"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return createClient(url, anon);
}

export default function CallbackClient() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const supabase = getSupabase();
        const { data } = await supabase.auth.getSession();

        if (data?.session?.user) {
          router.replace("/billing");
        } else {
          router.replace(`/login?next=${encodeURIComponent("/billing")}`);
        }
      } catch {
        router.replace(`/login?next=${encodeURIComponent("/billing")}`);
      }
    })();
  }, [router]);

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Signing you in…</h1>
      <p style={{ opacity: 0.75, marginTop: 8 }}>Please wait.</p>
    </main>
  );
}
