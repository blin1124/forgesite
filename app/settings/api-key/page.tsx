"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ApiKeySettingsPage() {
  const [apiKey, setApiKey] = useState("");
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [status, setStatus] = useState<string>("");

  async function getAccessToken() {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  }

  async function refreshHasKey() {
    const token = await getAccessToken();
    if (!token) {
      setHasKey(false);
      return;
    }
    const res = await fetch("/api/user/openai-key", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    setHasKey(!!json.hasKey);
  }

  useEffect(() => {
    refreshHasKey();
  }, []);

  async function saveKey() {
    setStatus("");
    const token = await getAccessToken();
    if (!token) {
      setStatus("You must be logged in first.");
      return;
    }

    const res = await fetch("/api/user/openai-key", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ apiKey }),
    });

    const json = await res.json();
    if (!res.ok) {
      setStatus(json?.error || "Failed to save key.");
      return;
    }

    setApiKey("");
    setStatus("Saved! ✅");
    await refreshHasKey();
  }

  return (
    <div style={{ maxWidth: 720, margin: "40px auto", padding: 20 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 10 }}>
        OpenAI API Key
      </h1>

      <p style={{ opacity: 0.9, marginBottom: 18 }}>
        To generate designs, ForgeSite uses <b>your</b> OpenAI API key. We store it
        encrypted.
      </p>

      <div style={{ marginBottom: 12 }}>
        <div style={{ marginBottom: 6, fontWeight: 700 }}>Status</div>
        <div>
          {hasKey === null ? "Checking..." : hasKey ? "Key on file ✅" : "No key saved ❌"}
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <div style={{ marginBottom: 6, fontWeight: 700 }}>Paste your key</div>
        <input
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.2)",
          }}
        />
        <button
          onClick={saveKey}
          style={{
            marginTop: 12,
            padding: "10px 14px",
            borderRadius: 10,
            border: "none",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Save API Key
        </button>

        {status && (
          <div style={{ marginTop: 10, fontWeight: 700 }}>
            {status}
          </div>
        )}
      </div>

      <hr style={{ margin: "24px 0" }} />

      <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
        How to get your OpenAI API key
      </h2>
      <ol style={{ lineHeight: 1.6 }}>
        <li>Create / log into your OpenAI account</li>
        <li>Go to the API keys page and create a key</li>
        <li>Paste it here and click “Save API Key”</li>
      </ol>

      <p style={{ marginTop: 8 }}>
        <a
          href="https://platform.openai.com/api-keys"
          target="_blank"
          rel="noreferrer"
          style={{ textDecoration: "underline" }}
        >
          OpenAI API Keys page
        </a>
      </p>

      <p style={{ marginTop: 18 }}>
        <Link href="/">← Back to home</Link>
      </p>
    </div>
  );
}
