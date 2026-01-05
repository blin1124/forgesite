"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type SiteRow = {
  id: string;
  template: string | null;
  content: string | null;
  html: string | null;
  created_at: string | null;
};

function prettyDate(s?: string | null) {
  if (!s) return "";
  try {
    const d = new Date(s);
    return d.toLocaleString();
  } catch {
    return s;
  }
}

export default function BuilderClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const tab = sp.get("tab") || "sites"; // sites | templates
  const selectedId = sp.get("site") || "";

  const [email, setEmail] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [sites, setSites] = useState<SiteRow[]>([]);
  const [sitesLoading, setSitesLoading] = useState(false);

  const selectedSite = useMemo(
    () => sites.find((s) => s.id === selectedId) || null,
    [sites, selectedId]
  );

  // editor state
  const [html, setHtml] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // load user + list sites
  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setErr("");

      try {
        const supabase = createSupabaseBrowserClient();

        const { data: authData, error: authErr } = await supabase.auth.getUser();
        if (authErr || !authData?.user) {
          router.replace(`/login?next=${encodeURIComponent("/builder")}`);
          return;
        }

        setEmail(authData.user.email || "");

        // load sites for this user
        setSitesLoading(true);
        const { data: siteRows, error: sitesErr } = await supabase
          .from("sites")
          .select("id, template, content, html, created_at")
          .eq("user_id", authData.user.id)
          .order("created_at", { ascending: false });

        if (sitesErr) throw sitesErr;

        setSites((siteRows as SiteRow[]) || []);
      } catch (e: any) {
        setErr(e?.message || "Failed to load builder data");
      } finally {
        setSitesLoading(false);
        setLoading(false);
      }
    };

    run();
  }, [router]);

  // when selected site changes, load its html into editor
  useEffect(() => {
    setSaveMsg("");
    setDirty(false);

    if (!selectedSite) {
      setHtml("");
      return;
    }

    // prefer html column, fallback to content
    const initial = selectedSite.html || selectedSite.content || "";
    setHtml(initial);
  }, [selectedSite?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function nav(params: Record<string, string | null>) {
    const next = new URLSearchParams(sp.toString());
    Object.entries(params).forEach(([k, v]) => {
      if (v === null) next.delete(k);
      else next.set(k, v);
    });
    router.replace(`/builder?${next.toString()}`);
  }

  async function save() {
    setErr("");
    setSaveMsg("");
    if (!selectedSite) return;

    try {
      setSaving(true);
      const supabase = createSupabaseBrowserClient();

      const { error } = await supabase
        .from("sites")
        .update({
          html,
          content: html, // keep in sync so older code still works
        })
        .eq("id", selectedSite.id);

      if (error) throw error;

      setDirty(false);
      setSaveMsg("Saved ✅");

      // refresh list locally
      setSites((prev) =>
        prev.map((s) => (s.id === selectedSite.id ? { ...s, html, content: html } : s))
      );
    } catch (e: any) {
      setErr(e?.message || "Save failed");
      setSaveMsg("");
    } finally {
      setSaving(false);
    }
  }

  async function createBlankSite() {
    setErr("");
    setSaveMsg("");

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) {
        router.replace(`/login?next=${encodeURIComponent("/builder")}`);
        return;
      }

      const starter = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>New Site</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; padding: 24px; }
    .card { max-width: 720px; margin: 0 auto; padding: 24px; border: 1px solid #ddd; border-radius: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Hello from ForgeSite ✨</h1>
    <p>Edit this HTML on the left. Preview updates on the right.</p>
  </div>
</body>
</html>`;

      const { data, error } = await supabase
        .from("sites")
        .insert({
          user_id: user.id,
          template: "html",
          content: starter,
          html: starter,
        })
        .select("id, template, content, html, created_at")
        .single();

      if (error) throw error;

      const row = data as SiteRow;
      setSites((prev) => [row, ...prev]);
      nav({ tab: "sites", site: row.id });
    } catch (e: any) {
      setErr(e?.message || "Create site failed");
    }
  }

  async function logout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return (
      <Shell email={email}>
        <Card>
          <h2 style={h2}>Loading…</h2>
          <p style={p}>Starting Builder</p>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell email={email}>
      <Header
        email={email}
        tab={tab}
        onTab={(t) => nav({ tab: t, site: t === "templates" ? null : selectedId || null })}
        onBilling={() => router.push("/billing?next=/builder")}
        onLogout={logout}
      />

      {err ? <ErrorBox text={err} /> : null}

      {tab === "templates" ? (
        <Card>
          <h2 style={h2}>Templates</h2>
          <p style={p}>
            This is the next step: template picker + “Generate site” flow. For now, click “My Sites” to edit
            the sites already in your database.
          </p>
        </Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 14, width: "min(1200px, 96vw)" }}>
          {/* LEFT: sites list */}
          <Card style={{ padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <h2 style={{ ...h2, margin: 0 }}>My Sites</h2>
              <button onClick={createBlankSite} style={smallBtn}>
                + New
              </button>
            </div>

            <div style={{ marginTop: 10, opacity: 0.85, fontSize: 13 }}>
              {sitesLoading ? "Loading sites…" : `${sites.length} site(s)`}
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {sites.map((s) => {
                const active = s.id === selectedId;
                return (
                  <button
                    key={s.id}
                    onClick={() => nav({ tab: "sites", site: s.id })}
                    style={{
                      ...siteRowBtn,
                      borderColor: active ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.18)",
                      background: active ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.10)",
                    }}
                  >
                    <div style={{ fontWeight: 900, fontSize: 13, textAlign: "left" }}>
                      {s.template || "site"} • {s.id.slice(0, 8)}
                    </div>
                    <div style={{ opacity: 0.85, fontSize: 12, textAlign: "left" }}>{prettyDate(s.created_at)}</div>
                  </button>
                );
              })}

              {!sitesLoading && sites.length === 0 ? (
                <div style={{ marginTop: 10, opacity: 0.9, fontSize: 13 }}>
                  No sites yet. Click <b>+ New</b>.
                </div>
              ) : null}
            </div>
          </Card>

          {/* RIGHT: editor + preview */}
          <Card style={{ padding: 12 }}>
            {!selectedSite ? (
              <div style={{ padding: 14 }}>
                <h2 style={h2}>Pick a site to edit</h2>
                <p style={p}>Select a site on the left, or click “+ New”.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 900 }}>Editor</div>
                      <div style={{ opacity: 0.85, fontSize: 12 }}>
                        {selectedSite.id} {dirty ? "• unsaved" : ""}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {saveMsg ? <span style={{ fontSize: 12, opacity: 0.9 }}>{saveMsg}</span> : null}
                      <button onClick={save} disabled={!dirty || saving} style={smallBtn}>
                        {saving ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </div>

                  <textarea
                    value={html}
                    onChange={(e) => {
                      setHtml(e.target.value);
                      setDirty(true);
                      setSaveMsg("");
                    }}
                    spellCheck={false}
                    style={textarea}
                  />
                </div>

                <div>
                  <div style={{ fontWeight: 900 }}>Preview</div>
                  <div style={{ opacity: 0.85, fontSize: 12, marginBottom: 8 }}>
                    Live preview of your saved/edited HTML
                  </div>

                  <iframe
                    title="preview"
                    sandbox="allow-same-origin"
                    style={iframe}
                    srcDoc={html || "<html><body style='font-family:system-ui;padding:24px;'>No HTML</body></html>"}
                  />
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </Shell>
  );
}

function Header({
  email,
  tab,
  onTab,
  onBilling,
  onLogout,
}: {
  email: string;
  tab: string;
  onTab: (t: string) => void;
  onBilling: () => void;
  onLogout: () => void;
}) {
  return (
    <div style={{ width: "min(1200px, 96vw)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div>
        <div style={{ fontSize: 44, fontWeight: 900, letterSpacing: 0.5 }}>Builder</div>
        <div style={{ opacity: 0.9, marginTop: 6 }}>
          Signed in as <b>{email}</b>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, background: "rgba(255,255,255,0.12)", padding: 6, borderRadius: 14 }}>
          <button onClick={() => onTab("sites")} style={tabBtn(tab === "sites")}>
            My Sites
          </button>
          <button onClick={() => onTab("templates")} style={tabBtn(tab === "templates")}>
            Templates
          </button>
        </div>

        <button onClick={onBilling} style={secondaryBtn}>
          Billing
        </button>

        <button onClick={onLogout} style={secondaryBtn}>
          Log out
        </button>
      </div>
    </div>
  );
}

function Shell({ children, email }: { children: React.ReactNode; email: string }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        alignContent: "start",
        justifyItems: "center",
        gap: 18,
        padding: "32px 18px 48px",
        color: "white",
        background:
          "radial-gradient(1200px 600px at 20% 0%, rgba(255,255,255,0.18), transparent 60%), linear-gradient(135deg, rgb(124,58,237) 0%, rgb(109,40,217) 35%, rgb(91,33,182) 100%)",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
      }}
    >
      {children}
    </main>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        width: "min(1200px, 96vw)",
        background: "rgba(255,255,255,0.12)",
        border: "1px solid rgba(255,255,255,0.18)",
        borderRadius: 18,
        padding: 18,
        boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function ErrorBox({ text }: { text: string }) {
  return (
    <div
      style={{
        width: "min(1200px, 96vw)",
        background: "rgba(185, 28, 28, .25)",
        border: "1px solid rgba(185, 28, 28, .5)",
        borderRadius: 14,
        padding: 12,
        whiteSpace: "pre-wrap",
      }}
    >
      {text}
    </div>
  );
}

const h2: React.CSSProperties = { margin: 0, fontSize: 20, fontWeight: 900 };
const p: React.CSSProperties = { marginTop: 8, opacity: 0.9 };

const tabBtn = (active: boolean): React.CSSProperties => ({
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  background: active ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.14)",
  color: active ? "rgb(85, 40, 150)" : "white",
  fontWeight: 900,
  cursor: "pointer",
});

const secondaryBtn: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "rgba(255,255,255,0.14)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const smallBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.20)",
  background: "rgba(255,255,255,0.16)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const siteRowBtn: React.CSSProperties = {
  width: "100%",
  textAlign: "left",
  padding: "10px 12px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.10)",
  color: "white",
  cursor: "pointer",
};

const textarea: React.CSSProperties = {
  width: "100%",
  height: "520px",
  marginTop: 10,
  padding: 12,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "rgba(20, 10, 40, 0.35)",
  color: "white",
  outline: "none",
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  fontSize: 12,
  lineHeight: 1.4,
};

const iframe: React.CSSProperties = {
  width: "100%",
  height: "560px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "white",
};

