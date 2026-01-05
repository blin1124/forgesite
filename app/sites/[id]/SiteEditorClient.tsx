"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function SiteEditorClient({ id }: { id: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  async function load() {
    setMsg("");
    setLoading(true);
    try {
      const { data: sessionRes } = await supabase.auth.getSession();
      if (!sessionRes?.session?.user) {
        router.replace(`/login?next=${encodeURIComponent(`/sites/${id}`)}`);
        return;
      }

      const { data, error } = await supabase
        .from("sites")
        .select("html")
        .eq("id", id)
        .single();

      if (error) throw error;
      setHtml(data?.html || "");
    } catch (e: any) {
      setMsg(e?.message || "Failed to load site");
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setMsg("");
    try {
      const { error } = await supabase.from("sites").update({ html }).eq("id", id);
      if (error) throw error;
      setMsg("Saved!");
      setTimeout(() => setMsg(""), 1200);
    } catch (e: any) {
      setMsg(e?.message || "Failed to save");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <main style={page}>
      <div style={topBar}>
        <button style={secondaryBtn} onClick={() => router.push("/builder")}>← Back</button>
        <div style={{ fontWeight: 900 }}>Editing: {id}</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={secondaryBtn} onClick={load} disabled={loading}>Reload</button>
          <button style={primaryBtn} onClick={save} disabled={loading}>Save</button>
        </div>
      </div>

      {msg ? <div style={note}>{msg}</div> : null}

      <div style={grid}>
        <textarea
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          placeholder="Paste HTML here…"
          style={editor}
        />
        <iframe title="preview" style={preview} srcDoc={html} />
      </div>
    </main>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  padding: 16,
  color: "white",
  background:
    "radial-gradient(1200px 600px at 20% 0%, rgba(255,255,255,0.18), transparent 60%), linear-gradient(135deg, rgb(124,58,237) 0%, rgb(109,40,217) 35%, rgb(91,33,182) 100%)",
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
};

const topBar: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 12,
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
};

const editor: React.CSSProperties = {
  minHeight: "78vh",
  width: "100%",
  padding: 12,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.22)",
  background: "rgba(0,0,0,0.22)",
  color: "white",
  outline: "none",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  fontSize: 13,
};

const preview: React.CSSProperties = {
  minHeight: "78vh",
  width: "100%",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.22)",
  background: "white",
};

const note: React.CSSProperties = {
  marginBottom: 12,
  padding: 10,
  borderRadius: 12,
  background: "rgba(255,255,255,0.12)",
  border: "1px solid rgba(255,255,255,0.18)",
};

const primaryBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.92)",
  color: "rgb(85, 40, 150)",
  fontWeight: 900,
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "rgba(255,255,255,0.14)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};
