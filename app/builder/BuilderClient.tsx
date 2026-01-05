"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type SiteRow = {
  id: string;
  template: string | null;
  prompt: string | null;
  html: string | null;
  created_at: string;
};

type ChatMsg = { role: "user" | "assistant"; content: string };

function lsGet(key: string) {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(key) || "";
}
function lsSet(key: string, val: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, val);
}

export default function BuilderClient() {
  const router = useRouter();

  // auth display
  const [email, setEmail] = useState<string>("");

  // OpenAI key (local only)
  const [apiKey, setApiKey] = useState<string>("");

  // prompt + html
  const [prompt, setPrompt] = useState<string>("");
  const [html, setHtml] = useState<string>("");

  // upload state
  const [fileUrl, setFileUrl] = useState<string>("");
  const [fileMime, setFileMime] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");

  // sites list
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // chat
  const [history, setHistory] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState<string>("");

  const [busy, setBusy] = useState<string>("");

  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const canUseAI = useMemo(() => apiKey.trim().startsWith("sk-"), [apiKey]);

  useEffect(() => {
    setApiKey(lsGet("forgesite_openai_key"));
    setPrompt(lsGet("forgesite_prompt"));
  }, []);

  useEffect(() => {
    lsSet("forgesite_openai_key", apiKey);
  }, [apiKey]);

  useEffect(() => {
    lsSet("forgesite_prompt", prompt);
  }, [prompt]);

  useEffect(() => {
    const run = async () => {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const userEmail = data?.session?.user?.email || "";
      setEmail(userEmail);

      await refreshSites();
    };
    run();
  }, []);

  async function refreshSites() {
    const res = await fetch("/api/sites/list");
    const data = await res.json().catch(() => ({}));
    setSites(Array.isArray(data?.sites) ? data.sites : []);
  }

  async function loadSite(id: string) {
    const found = sites.find((s) => s.id === id);
    if (!found) return;
    setSelectedId(id);
    setPrompt(found.prompt || "");
    setHtml(found.html || "");
    setHistory([]);
    setChatInput("");
  }

  async function generateHtml() {
    setBusy("");
    if (!canUseAI) {
      setBusy("Paste your OpenAI key first.");
      return;
    }
    if (!prompt.trim()) {
      setBusy("Enter a website prompt first.");
      return;
    }

    try {
      setBusy("Generating HTML…");

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey, prompt }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Generate failed");

      setHtml(String(data?.html || ""));
      setBusy("");
    } catch (e: any) {
      setBusy(e?.message || "Generate failed");
    }
  }

  async function saveSite() {
    setBusy("");
    if (!prompt.trim()) return setBusy("Prompt is empty.");
    if (!html.trim()) return setBusy("HTML is empty. Generate first.");

    try {
      setBusy("Saving…");
      const res = await fetch("/api/sites/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: selectedId, // if null, insert new
          template: "html",
          prompt,
          html,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Save failed");

      const newId = String(data?.id || "");
      setSelectedId(newId || selectedId);

      await refreshSites();
      setBusy("Saved ✅");
      setTimeout(() => setBusy(""), 1200);
    } catch (e: any) {
      setBusy(e?.message || "Save failed");
    }
  }

  async function uploadFile(file: File) {
    setBusy("");
    try {
      setBusy("Uploading…");

      const form = new FormData();
      form.append("file", file);

      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Upload failed");

      const u = String(data?.file_url || "");
      const m = String(data?.file_mime || "");
      const n = String(data?.file_name || file.name);

      if (!u) throw new Error("Upload returned no public URL");

      setFileUrl(u);
      setFileMime(m);
      setFileName(n);

      // ✅ inject into prompt so generator ALWAYS sees it
      setPrompt((p) => {
        const block = `\n\nATTACHMENT:\nNAME: ${n}\nMIME: ${m}\nURL: ${u}\n`;
        return p.includes(u) ? p : (p + block);
      });

      // ✅ auto-regenerate after upload
      setTimeout(() => {
        generateHtml();
      }, 50);

      setBusy("");
    } catch (e: any) {
      setBusy(e?.message || "Upload failed");
    }
  }

  async function runChat() {
    setBusy("");
    if (!canUseAI) return setBusy("Paste your OpenAI key first.");
    if (!chatInput.trim() && !fileUrl) return setBusy("Type a message or upload a file.");

    const userMsg: ChatMsg = { role: "user", content: chatInput.trim() || "(file attached)" };
    const nextHistory = [...history, userMsg];

    setHistory(nextHistory);
    setChatInput("");

    try {
      setBusy("Thinking…");

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          apiKey,
          message: userMsg.content,
          currentPrompt: prompt,
          history: nextHistory,
          file_url: fileUrl || null,
          file_mime: fileMime || null,
          file_name: fileName || null,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Chat failed");

      const reply = String(data?.reply || "OK");
      const prompt_update = String(data?.prompt_update || prompt);

      setHistory((h) => [...h, { role: "assistant", content: reply }]);

      setPrompt(prompt_update);

      // ✅ auto-regenerate after chat changes prompt
      setTimeout(() => {
        generateHtml();
      }, 50);

      setBusy("");
    } catch (e: any) {
      setBusy(e?.message || "Chat failed");
    }
  }

  async function logout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login?next=%2Fbuilder");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 16,
        color: "white",
        background:
          "radial-gradient(1200px 600px at 20% 0%, rgba(255,255,255,0.18), transparent 60%), linear-gradient(135deg, rgb(124,58,237) 0%, rgb(109,40,217) 35%, rgb(91,33,182) 100%)",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
      }}
    >
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontSize: 44, fontWeight: 900, lineHeight: 1 }}>Builder</div>
          <div style={{ opacity: 0.9 }}>Signed in as <b>{email || "unknown"}</b></div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button style={topBtn} onClick={() => router.push("/sites")}>My Sites</button>
          <button style={topBtn} onClick={() => router.push("/templates")}>Templates</button>
          <button style={topBtn} onClick={() => router.push("/billing")}>Billing</button>
          <button style={topBtn} onClick={logout}>Log out</button>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 14, marginTop: 14 }}>
        {/* LEFT */}
        <div style={{ display: "grid", gap: 14 }}>
          {/* Sites */}
          <section style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900 }}>My Sites</div>
                <div style={{ opacity: 0.85, fontSize: 13 }}>{sites.length} site(s)</div>
              </div>
              <button
                style={smallBtn}
                onClick={() => {
                  setSelectedId(null);
                  setPrompt("");
                  setHtml("");
                  setHistory([]);
                  setChatInput("");
                }}
              >
                + New
              </button>
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {sites.map((s) => (
                <button
                  key={s.id}
                  onClick={() => loadSite(s.id)}
                  style={{
                    ...siteBtn,
                    borderColor: selectedId === s.id ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.18)",
                  }}
                >
                  <div style={{ fontWeight: 900 }}>{(s.template || "html") + " • " + s.id.slice(0, 7)}</div>
                  <div style={{ opacity: 0.85, fontSize: 12 }}>
                    {new Date(s.created_at).toLocaleString()}
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* OpenAI Key */}
          <section style={card}>
            <div style={{ fontSize: 18, fontWeight: 900 }}>OpenAI Key (required)</div>
            <div style={{ opacity: 0.85, fontSize: 13, marginTop: 6 }}>
              Stored in your browser (local). Customers paste their own key before generating.
            </div>
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              type="password"
              style={{ ...input, marginTop: 10 }}
            />
          </section>

          {/* Prompt */}
          <section style={card}>
            <div style={{ fontSize: 18, fontWeight: 900 }}>Website Prompt</div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the site you want..."
              style={{ ...textarea, marginTop: 10 }}
            />

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
              <button style={primaryBtn} onClick={generateHtml}>Generate HTML</button>
              <button style={secondaryBtn} onClick={saveSite}>Save</button>

              <label style={uploadBtn}>
                Upload PDF/PNG/DOCX/XLSX
                <input
                  type="file"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadFile(f);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            </div>

            {busy ? (
              <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: "rgba(0,0,0,0.25)" }}>
                {busy}
              </div>
            ) : null}
          </section>

          {/* Chat */}
          <section style={card}>
            <div style={{ fontSize: 18, fontWeight: 900 }}>AI Chat (updates prompt)</div>

            <div style={chatBox}>
              {history.length === 0 ? (
                <div style={{ opacity: 0.8, fontSize: 13 }}>
                  Ask the AI to adjust the prompt. Uploads are included automatically.
                </div>
              ) : null}

              {history.map((m, idx) => (
                <div key={idx} style={{ marginTop: 10 }}>
                  <div style={{ fontWeight: 900 }}>{m.role === "user" ? "You" : "AI"}</div>
                  <div style={{ opacity: 0.92, whiteSpace: "pre-wrap" }}>{m.content}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Tell the AI what to change…"
                style={{ ...input, flex: 1 }}
              />
              <button style={primaryBtn} onClick={runChat}>Send</button>
            </div>
          </section>
        </div>

        {/* RIGHT */}
        <section style={card}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>Live Preview</div>
          <div style={{ marginTop: 10, borderRadius: 14, overflow: "hidden", border: "1px solid rgba(255,255,255,0.18)" }}>
            <iframe
              ref={iframeRef}
              title="preview"
              style={{ width: "100%", height: "78vh", background: "white" }}
              srcDoc={html || "<html><body style='font-family:system-ui;padding:40px'>Generate HTML to preview.</body></html>"}
              sandbox="allow-same-origin"
            />
          </div>
        </section>
      </div>
    </main>
  );
}

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.12)",
  border: "1px solid rgba(255,255,255,0.18)",
  borderRadius: 16,
  padding: 14,
  boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
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
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "rgba(255,255,255,0.14)",
  color: "white",
  outline: "none",
  resize: "vertical",
};

const topBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "rgba(255,255,255,0.14)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
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

const uploadBtn: React.CSSProperties = {
  ...secondaryBtn,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const smallBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "rgba(255,255,255,0.14)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const siteBtn: React.CSSProperties = {
  textAlign: "left",
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.10)",
  color: "white",
  cursor: "pointer",
};

const chatBox: React.CSSProperties = {
  marginTop: 10,
  height: 220,
  overflow: "auto",
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(0,0,0,0.18)",
};





