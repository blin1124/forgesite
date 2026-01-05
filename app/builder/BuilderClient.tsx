"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Msg = { role: "user" | "assistant"; content: string };

function lsGet(k: string) {
  try { return localStorage.getItem(k) || ""; } catch { return ""; }
}
function lsSet(k: string, v: string) {
  try { localStorage.setItem(k, v); } catch {}
}

export default function BuilderClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = useMemo(() => sp.get("next") || "/builder", [sp]);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [email, setEmail] = useState<string>("");
  const [apiKey, setApiKey] = useState<string>("");
  const [prompt, setPrompt] = useState<string>("");
  const [chatInput, setChatInput] = useState<string>("");
  const [history, setHistory] = useState<Msg[]>([]);
  const [html, setHtml] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [chatting, setChatting] = useState(false);
  const [msg, setMsg] = useState<string>("");

  // attachment (optional)
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileMime, setFileMime] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Sites list (basic)
  const [sites, setSites] = useState<any[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);

  useEffect(() => {
    // load OpenAI key from localStorage
    setApiKey(lsGet("forgesite_openai_key"));

    const boot = async () => {
      const { data } = await supabase.auth.getUser();
      const u = data?.user;
      if (!u) {
        router.replace(`/login?next=${encodeURIComponent(next)}`);
        return;
      }
      setEmail(u.email || "");

      // load sites for this user
      const { data: rows } = await supabase
        .from("sites")
        .select("id, created_at, template, content, html")
        .eq("user_id", u.id)
        .order("created_at", { ascending: false });

      setSites(rows || []);
    };

    boot();
  }, [router, next, supabase]);

  async function refreshSites() {
    const { data } = await supabase.auth.getUser();
    const u = data?.user;
    if (!u) return;

    const { data: rows } = await supabase
      .from("sites")
      .select("id, created_at, template, content, html")
      .eq("user_id", u.id)
      .order("created_at", { ascending: false });

    setSites(rows || []);
  }

  async function onLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  async function uploadFile(file: File) {
    setMsg("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(data?.error || `Upload failed (${res.status})`);

      setFileUrl(data.file_url || null);
      setFileName(data.file_name || file.name);
      setFileMime(data.file_mime || file.type || null);

      // Add a note in chat history so user sees it
      setHistory((h) => [
        ...h,
        { role: "assistant", content: `Attached: ${data.file_name}. I’ll incorporate it into your site prompt when you ask.` },
      ]);
    } catch (e: any) {
      setMsg(e?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function runChat() {
    setMsg("");
    if (!apiKey || !apiKey.startsWith("sk-")) {
      setMsg("Add your OpenAI API key first (starts with sk-).");
      return;
    }
    if (!chatInput.trim() && !fileUrl) {
      setMsg("Type a message or upload a file.");
      return;
    }

    const userMessage = chatInput.trim() || (fileUrl ? "Use the attached file in my website." : "");
    setChatInput("");

    const nextHistory: Msg[] = [...history, { role: "user", content: userMessage }];
    setHistory(nextHistory);
    setChatting(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          apiKey,
          message: userMessage,
          currentPrompt: prompt,
          history: nextHistory,
          file_url: fileUrl,
          file_name: fileName,
          file_mime: fileMime,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Chat failed (${res.status})`);

      const reply = String(data?.reply || "OK");
      const prompt_update = String(data?.prompt_update || prompt);

      setHistory((h) => [...h, { role: "assistant", content: reply }]);
      setPrompt(prompt_update);
    } catch (e: any) {
      setMsg(e?.message || "Chat failed");
    } finally {
      setChatting(false);
    }
  }

  async function generateHtml() {
    setMsg("");
    if (!apiKey || !apiKey.startsWith("sk-")) {
      setMsg("Add your OpenAI API key first (starts with sk-).");
      return;
    }
    if (!prompt.trim()) {
      setMsg("Enter a website prompt first (or use chat to build one).");
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey, prompt }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Generate failed (${res.status})`);

      setHtml(String(data?.html || ""));
    } catch (e: any) {
      setMsg(e?.message || "Generate failed");
    } finally {
      setGenerating(false);
    }
  }

  async function saveSite() {
    setMsg("");
    if (!html.trim()) {
      setMsg("Generate HTML first.");
      return;
    }

    setSaving(true);
    try {
      const { data } = await supabase.auth.getUser();
      const u = data?.user;
      if (!u) {
        router.replace(`/login?next=${encodeURIComponent(next)}`);
        return;
      }

      if (selectedSiteId) {
        const { error } = await supabase
          .from("sites")
          .update({
            content: prompt,
            html,
            template: "html",
            user_id: u.id,
          })
          .eq("id", selectedSiteId)
          .eq("user_id", u.id);

        if (error) throw new Error(error.message);
      } else {
        const { data: inserted, error } = await supabase
          .from("sites")
          .insert({
            user_id: u.id,
            template: "html",
            content: prompt,
            html,
          })
          .select("id")
          .single();

        if (error) throw new Error(error.message);
        setSelectedSiteId(inserted?.id || null);
      }

      await refreshSites();
      setMsg("Saved ✅");
    } catch (e: any) {
      setMsg(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function loadSite(row: any) {
    setSelectedSiteId(row.id);
    setPrompt(row.content || "");
    setHtml(row.html || "");
  }

  function newSite() {
    setSelectedSiteId(null);
    setPrompt("");
    setHtml("");
    setHistory([]);
    setFileUrl(null);
    setFileName(null);
    setFileMime(null);
  }

  return (
    <main style={page}>
      <header style={header}>
        <div>
          <div style={{ fontSize: 40, fontWeight: 900 }}>Builder</div>
          <div style={{ opacity: 0.9, marginTop: 6 }}>
            Signed in as <b>{email || "…"}</b>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button style={chipBtn} onClick={() => router.push("/sites")}>My Sites</button>
          <button style={chipBtn} onClick={() => router.push("/templates")}>Templates</button>
          <button style={chipBtn} onClick={() => router.push("/billing")}>Billing</button>
          <button style={chipBtn} onClick={onLogout}>Log out</button>
        </div>
      </header>

      <section style={shell}>
        {/* Left column: Sites + Prompt + Chat */}
        <div style={leftCol}>
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900 }}>My Sites</div>
                <div style={{ opacity: 0.85, fontSize: 13 }}>{sites.length} site(s)</div>
              </div>
              <button style={smallBtn} onClick={newSite}>+ New</button>
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {sites.map((s) => (
                <button
                  key={s.id}
                  onClick={() => loadSite(s)}
                  style={{
                    ...siteRow,
                    outline: selectedSiteId === s.id ? "2px solid rgba(255,255,255,0.6)" : "none",
                  }}
                >
                  <div style={{ fontWeight: 900, textAlign: "left" }}>
                    {String(s.template || "site")} · {String(s.id).slice(0, 7)}
                  </div>
                  <div style={{ opacity: 0.85, fontSize: 12, textAlign: "left" }}>
                    {s.created_at ? new Date(s.created_at).toLocaleString() : ""}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div style={card}>
            <div style={{ fontSize: 18, fontWeight: 900 }}>OpenAI Key (required)</div>
            <div style={{ opacity: 0.85, fontSize: 13, marginTop: 6 }}>
              This is stored in your browser (local). Customers paste their own key before generating.
            </div>
            <input
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                lsSet("forgesite_openai_key", e.target.value);
              }}
              placeholder="sk-…"
              type="password"
              style={{ ...input, marginTop: 10 }}
            />
          </div>

          <div style={card}>
            <div style={{ fontSize: 18, fontWeight: 900 }}>Website Prompt</div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the site you want…"
              style={textarea}
            />

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
              <button style={primaryBtn} onClick={generateHtml} disabled={generating}>
                {generating ? "Generating…" : "Generate HTML"}
              </button>
              <button style={secondaryBtn} onClick={saveSite} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>

              <label style={{ ...secondaryBtn, cursor: uploading ? "not-allowed" : "pointer" }}>
                {uploading ? "Uploading…" : "Upload PDF/PNG/DOCX/XLSX"}
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx"
                  style={{ display: "none" }}
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadFile(f);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            </div>

            {fileUrl ? (
              <div style={{ marginTop: 10, fontSize: 13, opacity: 0.95 }}>
                Attached: <b>{fileName}</b> ({fileMime})
              </div>
            ) : null}

            {msg ? (
              <div style={errorBox}>{msg}</div>
            ) : null}
          </div>

          <div style={card}>
            <div style={{ fontSize: 18, fontWeight: 900 }}>AI Chat (updates prompt)</div>

            <div style={chatBox}>
              {history.length === 0 ? (
                <div style={{ opacity: 0.8 }}>
                  Ask the AI to modify your site (colors, sections, copy, layout). Upload a doc/pdf/logo too.
                </div>
              ) : (
                history.map((m, i) => (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <div style={{ fontWeight: 900, opacity: 0.9 }}>
                      {m.role === "user" ? "You" : "AI"}
                    </div>
                    <div style={{ whiteSpace: "pre-wrap", opacity: 0.95 }}>{m.content}</div>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Tell the AI what to change…"
                style={{ ...input, flex: 1 }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") runChat();
                }}
              />
              <button style={primaryBtn} onClick={runChat} disabled={chatting}>
                {chatting ? "…" : "Send"}
              </button>
            </div>
          </div>
        </div>

        {/* Right column: Preview */}
        <div style={rightCol}>
          <div style={card}>
            <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>Live Preview</div>
            {!html ? (
              <div style={{ opacity: 0.85 }}>
                Generate HTML to preview. Your saved site HTML will show here too.
              </div>
            ) : (
              <iframe
                title="preview"
                style={iframe}
                sandbox="allow-same-origin allow-forms allow-popups allow-scripts"
                srcDoc={html}
              />
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  padding: 24,
  color: "white",
  background:
    "radial-gradient(1200px 600px at 20% 0%, rgba(255,255,255,0.18), transparent 60%), linear-gradient(135deg, rgb(124,58,237) 0%, rgb(109,40,217) 35%, rgb(91,33,182) 100%)",
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
};

const header: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
  marginBottom: 16,
};

const shell: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "520px 1fr",
  gap: 16,
};

const leftCol: React.CSSProperties = { display: "grid", gap: 16 };
const rightCol: React.CSSProperties = { display: "grid", gap: 16 };

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.12)",
  border: "1px solid rgba(255,255,255,0.18)",
  borderRadius: 16,
  padding: 16,
  boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
};

const chipBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.22)",
  background: "rgba(255,255,255,0.14)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const smallBtn: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.22)",
  background: "rgba(255,255,255,0.14)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const input: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "rgba(255,255,255,0.14)",
  color: "white",
  outline: "none",
};

const textarea: React.CSSProperties = {
  width: "100%",
  minHeight: 140,
  marginTop: 10,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "rgba(255,255,255,0.14)",
  color: "white",
  outline: "none",
  resize: "vertical",
};

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

const errorBox: React.CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 12,
  background: "rgba(185, 28, 28, .25)",
  border: "1px solid rgba(185, 28, 28, .5)",
  whiteSpace: "pre-wrap",
};

const chatBox: React.CSSProperties = {
  marginTop: 10,
  height: 220,
  overflow: "auto",
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(0,0,0,0.12)",
};

const siteRow: React.CSSProperties = {
  padding: 10,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(255,255,255,0.10)",
  color: "white",
  cursor: "pointer",
};

const iframe: React.CSSProperties = {
  width: "100%",
  height: "78vh",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: 14,
  background: "white",
};



