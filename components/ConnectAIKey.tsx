"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

type Status = string | null;

export default function ConnectAIKey() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Status>(null);
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        setLoading(true);
        setStatus(null);

        // ✅ IMPORTANT: supabaseBrowser is a FUNCTION — call it
        const sb = supabaseBrowser();

        // ✅ then use sb.auth
        const { data, error } = await sb.auth.getSession();

        if (error || !data?.session?.user?.id) {
          if (mounted) setStatus("You must be logged in.");
          return;
        }

        // Load any previously saved key (client-side only)
        const saved = localStorage.getItem("forge_apiKey") || "";
        if (mounted) setApiKey(saved);
        if (mounted) setStatus(saved ? "API key loaded." : "No API key saved yet.");
      } catch (e: any) {
        console.error("ConnectAIKey error:", e?.message || e);
        if (mounted) setStatus("Error loading session.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    run();

    return () => {
      mounted = false;
    };
  }, []);

  function save() {
    localStorage.setItem("forge_apiKey", apiKey);
    setStatus(apiKey ? "Saved." : "Cleared.");
  }

  if (loading) {
    return (
      <div style={{ fontSize: 14, opacity: 0.9 }}>
        Loading…
      </div>
    );
  }

  return (
    <div
      style={{
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,.14)",
        padding: 14,
        background: "rgba(0,0,0,.15)",
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 6 }}>OpenAI API Key (BYOK)</div>
      <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 10 }}>
        This is stored in your browser only (localStorage). Not saved to the server.
      </div>

      {status ? (
        <div
          style={{
            marginBottom: 10,
            fontSize: 13,
            opacity: 0.95,
          }}
        >
          {status}
        </div>
      ) : null}

      <input
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder="sk-..."
        type="password"
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,.18)",
          background: "rgba(0,0,0,.18)",
          color: "white",
          outline: "none",
        }}
      />

      <button
        onClick={save}
        style={{
          marginTop: 10,
          width: "100%",
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,.18)",
          background: "rgba(255,255,255,.14)",
          color: "white",
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        Save Key
      </button>
    </div>
  );
}




