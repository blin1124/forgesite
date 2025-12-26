"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type UploadAsset = {
  url: string;
  path: string;
  mime: string;
  name: string;
  size: number;
};

type ChatMsg = { role: "user" | "assistant"; content: string };

function ensureSessionId() {
  const KEY = "forge_sessionId";
  let id = "";
  try {
    id = localStorage.getItem(KEY) || "";
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
  } catch {
    // ignore (privacy mode)
  }
  return id || "unknown-session";
}

export default function BuilderPage() {
  // -----------------------------
  // Core state (KEEP PROMPT BLANK)
  // -----------------------------
  const [apiKey, setApiKey] = useState(""); // ✅ always blank on load
  const [prompt, setPrompt] = useState<string>(""); // ✅ blank by default
  const [generatedHtml, setGeneratedHtml] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);

  // Upload state
  const [assets, setAssets] = useState<UploadAsset[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [lastUpload, setLastUpload] = useState<UploadAsset | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Chat state
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMsg[]>([]);
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [chatBusy, setChatBusy] = useState(false);

  // Save state
  const [isSaving, setIsSaving] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // -----------------------------
  // Helpers
  // -----------------------------
  const canGenerate = useMemo(() => {
    return !!apiKey.trim() && !!prompt.trim() && !isGenerating;
  }, [apiKey, prompt, isGenerating]);

  const canSave = useMemo(() => {
    return !!prompt.trim() && !!generatedHtml.trim() && !isSaving;
  }, [prompt, generatedHtml, isSaving]);

  function toastCopy(text: string) {
    try {
      navigator.clipboard.writeText(text);
      alert("Copied!");
    } catch {
      alert("Copy failed. You can manually select the URL and copy it.");
    }
  }

  function useInChat(asset: UploadAsset) {
    const line = `Use this uploaded file: ${asset.url} (${asset.mime || "unknown"})`;
    setChatInput((s) => (s ? `${s}\n${line}` : line));
  }

  // -----------------------------
  // Upload
  // -----------------------------
  async function onUpload() {
    if (!selectedFile) return;
    setIsUploading(true);
    setLastUpload(null);

    try {
      const fd = new FormData();
      fd.append("file", selectedFile);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: fd,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error || "Upload failed");
        return;
      }

      const asset: UploadAsset = data;
      setAssets((prev) => [asset, ...prev]);
      setLastUpload(asset);
      setSelectedFile(null);
    } finally {
      setIsUploading(false);
    }
  }

  // -----------------------------
  // Chat (rewrites prompt)
  // -----------------------------
  async function onSendChat() {
    const message = chatInput.trim();
    if (!message && !lastUpload) return;

    setChatBusy(true);
    try {
      const file_url = lastUpload?.url || null;
      const file_mime = lastUpload?.mime || null;
      const file_name = lastUpload?.name || null;

      const nextHistory: ChatMsg[] = [
        ...chatHistory,
        ...(message ? [{ role: "user", content: message } as ChatMsg] : []),
      ];
      setChatHistory(nextHistory);
      setChatInput("");

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          apiKey,
          message: message || (file_url ? "User attached a file and needs help using it." : ""),
          currentPrompt: prompt,
          history: nextHistory,
          file_url,
          file_mime,
          file_name,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChatHistory((h) => [
          ...h,
          { role: "assistant", content: `Sorry—chat failed: ${data?.error || "Unknown error"}` },
        ]);
        return;
      }

      const reply = String(data?.reply || "");
      const prompt_update = String(data?.prompt_update || "");

      if (reply) setChatHistory((h) => [...h, { role: "assistant", content: reply }]);
      if (prompt_update) setPrompt(prompt_update);

      if (autoGenerate && prompt_update?.trim()) {
        await onGenerate(prompt_update);
      }
    } finally {
      setChatBusy(false);
    }
  }

  // -----------------------------
  // Generate
  // -----------------------------
  async function onGenerate(forcePrompt?: string) {
    const p = (forcePrompt ?? prompt).trim();
    if (!apiKey.trim()) {
      alert("Missing apiKey. Paste your OpenAI key into the Builder page.");
      return;
    }
    if (!p) {
      alert("Missing prompt");
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey, prompt: p }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error || "Generate failed");
        return;
      }

      const html = String(data?.html || "");
      setGeneratedHtml(html);

      if (iframeRef.current) {
        const doc = iframeRef.current.contentDocument;
        if (doc) {
          doc.open();
          doc.write(html);
          doc.close();
        }
      }
    } finally {
      setIsGenerating(false);
    }
  }

  // Keep iframe updated if html changes
  useEffect(() => {
    if (!generatedHtml || !iframeRef.current) return;
    const doc = iframeRef.current.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(generatedHtml);
    doc.close();
  }, [generatedHtml]);

  // -----------------------------
  // Save (TO SUPABASE via /api/save)
  // -----------------------------
  async function onSaveWebsite() {
    if (!prompt.trim() || !generatedHtml.trim()) {
      alert("Nothing to save yet. Generate a website first.");
      return;
    }

    setIsSaving(true);
    try {
      const session_id = ensureSessionId();
      const name =
        prompt.trim().split("\n")[0].slice(0, 60) || "Untitled Site";

      const res = await fetch("/api/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          session_id,
          name,
          prompt,
          html: generatedHtml,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error || "Save failed");
        return;
      }

      alert(
        `Saved to Supabase ✅\nmode: ${data?.mode || "unknown"}\nid: ${data?.saved?.id || "(none)"}`
      );
    } finally {
      setIsSaving(false);
    }
  }

  // -----------------------------
  // UI
  // -----------------------------
  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <h1 style={{ fontSize: 44, fontWeight: 800, letterSpacing: -0.5, marginBottom: 6 }}>
          ForgeSite AI — Builder
        </h1>
        <p style={{ opacity: 0.85, marginBottom: 22 }}>
          Chat can rewrite your prompt. Preview updates when you click <b>Generate Website</b> (or auto-generate if enabled).
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          {/* LEFT: Prompt + Generate */}
          <div style={panelStyle}>
            <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 8 }}>
              OpenAI API Key (Bring Your Own Key)
            </div>

            {/* ✅ ALWAYS blank on load; only faded placeholder */}
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              type="password"
              style={inputStyle}
              autoComplete="off"
            />

            <div style={{ fontSize: 12, opacity: 0.85, margin: "14px 0 8px" }}>
              What can I design for you today?
            </div>

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="" // ✅ blank placeholder
              style={{ ...textareaStyle, height: 170 }}
            />

            <button
              onClick={() => onGenerate()}
              disabled={!canGenerate}
              style={{
                ...buttonStyle,
                opacity: canGenerate ? 1 : 0.55,
                marginTop: 12,
                width: "100%",
              }}
            >
              {isGenerating ? "Generating..." : "Generate Website"}
            </button>

            {/* Uploaded assets list */}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 8 }}>Uploaded assets</div>
              {assets.length === 0 ? (
                <div style={{ fontSize: 12, opacity: 0.7 }}>None yet.</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {assets.map((a) => (
                    <div key={a.path} style={assetCardStyle}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{a.name}</div>
                      <div style={{ fontSize: 12, opacity: 0.75 }}>{a.mime}</div>
                      <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6, wordBreak: "break-word" }}>
                        {a.url}
                      </div>
                      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                        <button style={smallButtonStyle} onClick={() => useInChat(a)}>
                          Use in chat
                        </button>
                        <button style={smallButtonStyle} onClick={() => toastCopy(a.url)}>
                          Copy URL
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Chat + Upload */}
          <div style={panelStyle}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Chat with AI</div>
            <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 10 }}>
              Ask for changes. Chat will update your prompt (and auto-generate if enabled).
            </div>

            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, opacity: 0.95 }}>
              <input
                type="checkbox"
                checked={autoGenerate}
                onChange={(e) => setAutoGenerate(e.target.checked)}
              />
              Auto-generate after chat updates the prompt
            </label>

            <div style={chatWindowStyle}>
              {chatHistory.length === 0 ? (
                <div style={{ fontSize: 13, opacity: 0.8 }}>
                  Tell me what you want to build or change (colors, sections, style, content). I’ll rewrite the prompt for you.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {chatHistory.map((m, idx) => (
                    <div key={idx} style={chatBubbleStyle(m.role)}>
                      <div style={{ fontWeight: 800, fontSize: 12, opacity: 0.9, marginBottom: 4 }}>
                        {m.role === "user" ? "You" : "AI"}
                      </div>
                      {m.content}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginTop: 10 }}>
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type your request here…"
                style={{
                  ...textareaStyle,
                  height: 92,
                  resize: "vertical",
                  overflow: "auto",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  border: "2px solid rgba(255,255,255,0.22)", // visible typing border
                }}
              />

              <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10 }}>
                <button
                  onClick={onSendChat}
                  disabled={chatBusy || (!chatInput.trim() && !lastUpload)}
                  style={{
                    ...buttonStyle,
                    width: 120,
                    opacity: chatBusy || (!chatInput.trim() && !lastUpload) ? 0.55 : 1,
                  }}
                >
                  {chatBusy ? "Sending…" : "Send"}
                </button>

                <div style={{ fontSize: 12, opacity: 0.85 }}>
                  {lastUpload ? (
                    <>
                      Selected: <b>{lastUpload.name}</b>
                    </>
                  ) : selectedFile ? (
                    <>
                      Selected: <b>{selectedFile.name}</b>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Upload */}
            <div style={{ marginTop: 14 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <label style={uploadButtonStyle}>
                  Attach file
                  <input
                    type="file"
                    hidden
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  />
                </label>

                <div style={{ fontSize: 12, opacity: 0.85 }}>
                  Optional: PDF/PNG/JPG/DOCX/XLSX/TXT/CSV/MD/JSON
                </div>

                <button
                  onClick={onUpload}
                  disabled={!selectedFile || isUploading}
                  style={{
                    ...smallButtonStyle,
                    opacity: !selectedFile || isUploading ? 0.55 : 1,
                  }}
                >
                  {isUploading ? "Uploading…" : "Upload"}
                </button>
              </div>

              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.78 }}>
                Some file previews (like PDFs) depend on your browser’s security settings. If a preview doesn’t appear, use{" "}
                <span style={{ textDecoration: "underline" }}>Copy URL</span> and open it in a new tab.
              </div>

              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>
                {lastUpload ? "Last upload ready ✅" : null}
              </div>
            </div>
          </div>
        </div>

        {/* PREVIEW */}
        <div style={previewPanelStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontWeight: 800, marginBottom: 4 }}>Preview</div>
              <div style={{ fontSize: 12, opacity: 0.85 }}>
                This renders the generated HTML directly.
              </div>
            </div>

            <button
              onClick={onSaveWebsite}
              disabled={!canSave}
              style={{
                ...buttonStyle,
                width: 140,
                opacity: canSave ? 1 : 0.55,
              }}
              title="Save this generated site into Supabase"
            >
              {isSaving ? "Saving…" : "Save Website"}
            </button>
          </div>

          <div style={{ marginTop: 10, borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.16)" }}>
            <iframe
              ref={iframeRef}
              title="preview"
              style={{ width: "100%", height: 560, background: "white" }}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          </div>

          {!generatedHtml ? (
            <div style={{ fontSize: 13, opacity: 0.8, marginTop: 10 }}>
              Nothing generated yet. Describe what you want and click <b>Generate Website</b>.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// -----------------------------
// Inline styles
// -----------------------------
const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: "32px 20px 60px",
  background:
    "radial-gradient(1200px 600px at 20% 0%, rgba(255,255,255,0.18), transparent 60%), linear-gradient(135deg, rgb(124,58,237) 0%, rgb(109,40,217) 35%, rgb(91,33,182) 100%)",
  color: "white",
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
};

const panelStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.12)",
  border: "1px solid rgba(255,255,255,0.18)",
  borderRadius: 16,
  padding: 16,
  boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
};

const previewPanelStyle: React.CSSProperties = {
  marginTop: 18,
  background: "rgba(255,255,255,0.12)",
  border: "1px solid rgba(255,255,255,0.18)",
  borderRadius: 16,
  padding: 14,
  boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  outline: "none",
  background: "rgba(0,0,0,0.18)",
  color: "white",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  outline: "none",
  background: "rgba(0,0,0,0.18)",
  color: "white",
  lineHeight: 1.35,
};

const buttonStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.14)",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
};

const smallButtonStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.14)",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
};

const uploadButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(239,68,68,0.90)",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
};

const chatWindowStyle: React.CSSProperties = {
  marginTop: 10,
  height: 210,
  overflow: "auto",
  padding: 10,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(0,0,0,0.18)",
};

const chatBubbleStyle = (role: "user" | "assistant"): React.CSSProperties => ({
  padding: 10,
  borderRadius: 12,
  background: role === "user" ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.18)",
  border: "1px solid rgba(255,255,255,0.14)",
  fontSize: 13,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
});

const assetCardStyle: React.CSSProperties = {
  background: "rgba(0,0,0,0.18)",
  border: "1px solid rgba(255,255,255,0.16)",
  borderRadius: 14,
  padding: 12,
};


















