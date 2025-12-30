"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return createClient(url, anon);
}

export default function AccountPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const supabase = getSupabase();
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        setEmail(data?.session?.user?.email ?? null);
      } catch (e: any) {
        setErr(e?.message || "Failed to load session");
      }
    };
    run();
  }, []);

  return (
    <main style={{ minHeight: "100vh", padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800 }}>Account</h1>
      {err ? <p style={{ color: "crimson" }}>{err}</p> : null}
      <p style={{ opacity: 0.85 }}>{email ? `Signed in as ${email}` : "Not signed in"}</p>
      <p style={{ marginTop: 12 }}>
        <a href="/settings" style={{ textDecoration: "underline" }}>Settings</a>
      </p>
    </main>
  );
}


