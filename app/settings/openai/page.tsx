"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-browser";

export default function OpenAISettingsPage() {
  const [loading, setLoading] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);

  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      // 1) Get current session
      const { data, error } = await supabase.auth.getSession();

      if (!mounted) return;

      if (error) {
        console.error("getSession error:", error);
        setIsAuthed(false);
      } else {
        setIsAuthed(!!data.session);
      }

      setLoading(false);
    }

    init();

    // 2) Keep UI in sync if user logs in/out
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthed(!!session);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function onSave() {
    setMessage(null);

    if (!isAuthed) {
      setMessage("You must be logged in.");
      return;
    }

    if (!apiKey.trim()) {
      setMessage("Paste an OpenAI API key first.");
      return;
    }

    setSaving(true);
    try {
      const { data: sessionData, error: sessionErr } =
        await supabase.auth.getSession();

      if (sessionErr || !sessionData.session) {
        setMessage("Session not found. Please log in again.");
        return;
      }

      // NOTE: This endpoint should already exist in your app.
      // Step 4.1 is only about using the shared supabase client + auth session.
      const res = await fetch("/api/user/openai-key", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({ apiKey }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setMessage(json?.error || "Failed to save key.");
        return;
      }

      setApiKey("");
      setMessage("Saved!");
    } catch (e: any) {
      console.error(e);
      setMessage("Unexpected error saving key.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
        OpenAI API Key
      </h1>

      <p style={{ marginBottom: 16 }}>
        Paste your OpenAI API key below. It is encrypted before storage.
      </p>

      <input
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder="sk-..."
        style={{
          width: "100%",
          padding: 12,
          border: "1px solid #ccc",
          borderRadius: 6,
          marginBottom: 12,
        }}
        disabled={loading || saving}
      />

      <button
        onClick={onSave}
        disabled={loading || saving}
        style={{
          padding: "10px 16px",
          borderRadius: 6,
          border: "none",
          cursor: loading || saving ? "not-allowed" : "pointer",
          opacity: loading || saving ? 0.6 : 1,
        }}
      >
        {saving ? "Saving..." : "Save API Key"}
      </button>

      <div style={{ marginTop: 12 }}>
        {loading ? (
          <div>Checking login...</div>
        ) : !isAuthed ? (
          <div style={{ color: "#111" }}>You must be logged in.</div>
        ) : message ? (
          <div style={{ color: message === "Saved!" ? "green" : "#111" }}>
            {message}
          </div>
        ) : null}
      </div>
    </div>
  );
}

