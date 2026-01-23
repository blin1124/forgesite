"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type SiteRow = {
  id: string;
  template: string | null;
  prompt: string | null;
  html: string | null;
  content?: string | null;
  created_at: string;
};

type ChatMsg = { role: "user" | "assistant"; content: string };

async function readResponse(res: Response) {
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { text, json };
}

export default function BuilderClient() {
  const router = useRouter();

  const [email, setEmail] = useState<string>("");

  const [apiKey, setApiKey] = useState<string>("");
  const [prompt, setPrompt] = useState<string>("");

  const [html, setHtml] = useState<string>("");

  const [fileUrl, setFileUrl] = useState<string>("");
  const [fileMime, setFileMime] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");

  const [sites, setSites] = useState<SiteRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [history, setHistory] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState<string>("");

  const [busy, setBusy] = useState<string>("");
  const [debug, setDebug] = useState<string>("");

  const [publishingId, setPublishingId] = useState<string>("");

  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const canUseAI = useMemo(() => apiKey.trim().startsWith("sk-"), [apiKey]);

  useEffect(() => {
    const run = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();
        setEmail(data?.session?.user?.email || "");
      } catch {
        setEmail("");
      }
      await refreshSites();
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshSites() {
    try {
      const res = await fetch("/api/sites/list", { cache: "no-store" });
      const { text, json } = await readResponse(res);
      if (!res.ok) throw new Error(json?.error || `List failed (${res.status}): ${text.slice(0, 200)}`);
      setSites(Array.isArray(json?.sites) ? json.sites : []);
    } catch (e: any) {
      setDebug(e?.message || "Failed to list sites");
    }
  }

  async function loadSite(id: string) {
    const found = sites.find((s) => s.id === id);
    if (!found) return;

    setSelectedId(id);
    setPrompt(found.prompt || "");
    setHtml(found.html || "");
    setHistory([]);
    setChatInput("");
    setBusy("");
    setDebug("");
  }

  async function generateHtml(promptOverride?: string) {
    setBusy("");
    setDebug("");

    const usePrompt = (promptOverride ?? prompt ?? "").trim();

    if (!canUseAI) return setBusy("Paste your OpenAI key first.");
    if (!usePrompt) return setBusy("Enter a website prompt first.");

    try {
      setBusy("Generating HTML…");

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey, prompt: usePrompt }),
      });

      const { text, json } = await readResponse(res);
      if (!res.ok) throw new Error(json?.error || `Generate failed (${res.status}): ${text.slice(0, 240)}`);

      const nextHtml = String(json?.html || "");
      if (!nextHtml.trim()) throw new Error("Generate returned empty HTML.");

      setHtml(nextHtml);
      setBusy("");
    } catch (e: any) {
      setBusy(e?.message || "Generate failed");
      setDebug(String(e?.stack || ""));
    }
  }

  async function saveSite() {
    setBusy("");
    setDebug("");

    if (!prompt.trim()) return setBusy("Prompt is empty.");
    if (!html.trim()) return setBusy("HTML is empty. Generate first.");

    try {
      setBusy("Saving…");

      const res = await fetch("/api/sites/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: selectedId,
          template: "html",
          prompt,
          html,
        }),
      });

      const { text, json } = await readResponse(res);
      if (!res.ok) throw new Error(json?.error || `Save failed (${res.status}): ${text.slice(0, 240)}`);

      const newId = String(json?.id || "");
      if (newId) setSelectedId(newId);

      await refreshSites();
      setBusy("Saved ✅");
      setTimeout(() => setBusy(""), 1200);
    } catch (e: any) {
      setBusy(e?.message || "Save failed");
      setDebug(String(e?.stack || ""));
    }
  }

  async function uploadFile(file: File) {
    setBusy("");
    setDebug("");

    try {
      setBusy("Uploading…");

      const form = new FormData();
      form.append("file", file);

      const res = await fetch("/api/upload", { method: "POST", body: form });
      const { text, json } = await readResponse(res);

      if (!res.ok) throw new Error(json?.error || `Upload failed (${res.status}): ${text.slice(0, 240)}`);

      const u = String(json?.file_url || json?.url || "");
      const m = String(json?.file_mime || json?.mime || file.type || "");
      const n = String(json?.file_name || json?.name || file.name || "");

      if (!u.startsWith("http")) throw new Error(`Upload returned invalid file_url: ${u || "(empty)"}`);

      setFileUrl(u);
      setFileMime(m);
      setFileName(n);

      const block = `\n\nATTACHMENT:\nNAME: ${n}\nMIME: ${m}\nURL: ${u}\n`;
      const nextPrompt = prompt.includes(u) ? prompt : prompt + block;

      setPrompt(nextPrompt);
      setTimeout(() => generateHtml(nextPrompt), 50);

      setBusy("Uploaded ✅ (and regenerating)");
      setTimeout(() => setBusy(""), 1200);
    } catch (e: any) {
      setBusy(e?.message || "Upload failed");
      setDebug(String(e?.stack || ""));
    }
  }

  async function runChat() {
    setBusy("");
    setDebug("");

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

      const { text, json } = await readResponse(res);
      if (!res.ok) throw new Error(json?.error || `Chat failed (${res.status}): ${text.slice(0, 240)}`);

      const reply = String(json?.reply || "OK");
      const prompt_update = String(json?.prompt_update || prompt);

      setHistory((h) => [...h, { role: "assistant", content: reply }]);
      setPrompt(prompt_update);

      setTimeout(() => generateHtml(prompt_update), 50);

      setBusy("");
    } catch (e: any) {
      setBusy(e?.message || "Chat failed");
      setDebug(String(e?.stack || ""));
    }
  }

  // ✅ NEW: resolve "live URL" for a site
  // - if verified domain exists: https://domain
  // - else: /s/{siteId}
  async function getLiveUrlForSite(siteId: string) {
    let openUrl = `/s/${encodeURIComponent(siteId)}`;

    try {
      const dres = await fetch(`/api/sites/${encodeURIComponent(siteId)}/domain`, { cache: "no-store" });
      const { json: djson } = await readResponse(dres);

      const domain = String(djson?.domain || "").trim();
      const status = String(djson?.status || "").toLowerCase();

      if (domain && status === "verified") {
        openUrl = `https://${domain}`;
      }
    } catch {
      // ignore lookup failures, fall back to /s/{siteId}
    }

    return openUrl;
  }

  // ✅ IMPORTANT FIX:
  // When publishing the CURRENTLY loaded site, we send the current editor html/prompt.
  // This prevents publishing an older DB draft if Save didn't persist for any reason.
  async function publishSite(siteId: string) {
    setBusy("");
    setDebug("");
    setPublishingId(siteId);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionRes } = await supabase.auth.getSession();
      const token = sessionRes?.session?.access_token;

      if (!token) {
        router.replace("/login?next=/builder");
        return;
      }

      const isCurrent = selectedId === siteId;

      const res = await fetch(`/api/sites/${encodeURIComponent(siteId)}/publish`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(
          isCurrent
            ? {
                // publish what you SEE in the editor
                html,
                prompt,
              }
            : {}
        ),
      });

      const { text, json } = await readResponse(res);

      if (!res.ok) {
        throw new Error(json?.error || `Publish failed (${res.status}): ${text.slice(0, 240)}`);
      }

      await refreshSites();

      const openUrl = await getLiveUrlForSite(siteId);

      setBusy("Published ✅ Opening live site…");
      window.open(openUrl, "_blank", "noopener,noreferrer");

      setTimeout(() => setBusy(""), 1200);
    } catch (e: any) {
      setBusy(e?.message || "Publish failed");
      setDebug(String(e?.stack || ""));
    } finally {
      setPublishingId("");
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
          <div style={{ opacity: 0.9 }}>
            Signed in as <b>{email || "unknown"}</b>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button style={topBtn} onClick={() => router.push("/sites")}>
            My Sites
          </button>
          <button style={topBtn} onClick={() => router.push("/templates")}>
            Templates
          </button>
          <button style={topBtn} onClick={() => router.push("/billing")}>
            Billing
          </button>
          <button style={topBtn} onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 14, marginTop: 14 }}>
        {/* LEFT */}
        <div style={{ display: "grid", gap: 14 }}>
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
                  setFileUrl("");
                  setFileMime("");
                  setFileName("");
                  setBusy("");
                  setDebug("");
                }}
              >
                + New
              </button>
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {sites.map((s) => {
                const isBusy = publishingId === s.id;

                return (
                  <div key={s.id} style={{ display: "grid", gap: 8 }}>
                    <button
                      onClick={() => loadSite(s.id)}
                      style={{
                        ...siteBtn,
                        borderColor: selectedId === s.id ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.18)",
                      }}
                    >
                      <div style={{ fontWeight: 900 }}>{(s.template || "html") + " • " + s.id.slice(0, 7)}</div>
                      <div style={{ opacity: 0.85, fontSize: 12 }}>{new Date(s.created_at).toLocaleString()}</div>
                    </button>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button style={primaryBtn} onClick={() => publishSite(s.id)} disabled={isBusy}>
                        {isBusy ? "Publishing…" : "Publish"}
                      </button>

                      <button
                        style={secondaryBtn}
                        onClick={() => router.push(`/domain?siteId=${encodeURIComponent(s.id)}`)}
                        disabled={isBusy}
                      >
                        Domain
                      </button>

                      <button
                        style={secondaryBtn}
                        onClick={() => window.open(`/s/${encodeURIComponent(s.id)}`, "_blank", "noopener,noreferrer")}
                        disabled={isBusy}
                      >
                        View
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section style={card}>
            <div style={{ fontSize: 18, fontWeight: 900 }}>OpenAI Key (required)</div>
            <div style={{ opacity: 0.85, fontSize: 13, marginTop: 6 }}>
              This field starts blank. Customers must paste their own key before generating.
            </div>
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              type="password"
              style={{ ...input, marginTop: 10 }}
            />
          </section>

          <section style={card}>
            <div style={{ fontSize: 18, fontWeight: 900 }}>Website Prompt</div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the site you want..."
              style={{ ...textarea, marginTop: 10 }}
            />

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
              <button style={primaryBtn} onClick={() => generateHtml()}>
                Generate HTML
              </button>
              <button style={secondaryBtn} onClick={saveSite}>
                Save
              </button>

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

            {fileUrl || fileName ? (
              <div style={{ marginTop: 10, fontSize: 13, opacity: 0.95 }}>
                <div>
                  <b>Last upload:</b> {fileName || "(no name)"} ({fileMime || "unknown"})
                </div>
                <div style={{ wordBreak: "break-all" }}>
                  <b>URL:</b> {fileUrl || "(none)"}
                </div>
              </div>
            ) : null}

            {busy ? (
              <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: "rgba(0,0,0,0.25)" }}>
                {busy}
              </div>
            ) : null}

            {debug ? (
              <div
                style={{
                  marginTop: 10,
                  padding: 10,
                  borderRadius: 12,
                  background: "rgba(185, 28, 28, .25)",
                  border: "1px solid rgba(185, 28, 28, .5)",
                }}
              >
                <div style={{ fontWeight: 900 }}>Debug</div>
                <div style={{ whiteSpace: "pre-wrap", fontSize: 12, opacity: 0.95 }}>{debug}</div>
              </div>
            ) : null}
          </section>

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

            <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Tell the AI what to change…"
                style={{ ...input, flex: 1, minWidth: 220 }}
              />
              <button style={primaryBtn} onClick={runChat}>
                Send
              </button>

              <button style={secondaryBtn} onClick={() => router.push("/domain")}>
                Connect Domain
              </button>
            </div>
          </section>
        </div>

        {/* RIGHT */}
        <section style={card}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>Live Preview</div>
          <div style={{ marginTop: 10, borderRadius: 14, overflow: "hidden", border: "1px solid rgba(255,255,255,0.18)" }}>
            <iframe
              key={`${selectedId || "new"}-${html.length}`}
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

// ---- styles ----

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



