"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type SiteRow = {
  id: string;
  template: string | null;
  content: string | null;
  html: string | null;
  created_at: string | null;
  user_id: string | null;
};

export default function BuilderClient() {
  const router = useRouter();
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  async function loadSites() {
    setMsg("");
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionRes } = await supabase.auth.getSession();
      const user = sessionRes?.session?.user;
      if (!user) {
        router.replace("/login?next=/builder");
        return;
      }

      const { data, error } = await supabase
        .from("sites")
        .select("id, template, content, html, created_at, user_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSites((data as any) || []);
    } catch (e: any) {
      setMsg(e?.message || "Failed to load sites");
    } finally {
      setLoading(false);
    }
  }

  async function createSite() {
    setMsg("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionRes } = await supabase.auth.getSession();
      const user = sessionRes?.session?.user;
      if (!user) {
        router.replace("/login?next=/builder");
        return;
      }

      const { data, error } = await supabase
        .from("sites")
        .insert({
          user_id: user.id,
          template: "html",
          content: "generated",
          html: "<!doctype html><html><head><meta charset='utf-8'/><title>New Site</title></head><body><h1>New Site</h1><p>Edit me.</p></body></html>",
        })
        .select("id")
        .single();

      if (error) throw error;
      router.push(`/sites/${data.id}`);
    } catch (e: any) {
      setMsg(e?.message || "Failed to create site");
    }
  }

  useEffect(() => {
    loadSites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main style={page}>
      <div style={shell}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 34, fontWeight: 900 }}>Builder</h1>
            <div style={{ opacity: 0.85, marginTop: 6 }}>Your sites (from Supabase)</div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={createSite} style={primaryBtn}>+ New site</button>
            <button onClick={loadSites} style={secondaryBtn}>Refresh</button>
            <button onClick={() => router.push("/billing?next=/builder")} style={secondaryBtn}>Billing</button>
          </div>
        </div>

        {msg ? <div style={errorBox}>{msg}</div> : null}

        {loading ? (
          <div style={{ marginTop: 18, opacity: 0.9 }}>Loading…</div>
        ) : sites.length === 0 ? (
          <div style={{ marginTop: 18, opacity: 0.9 }}>
            No sites found. Click <b>New site</b>.
          </div>
        ) : (
          <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
            {sites.map((s) => (
              <button
                key={s.id}
                onClick={() => router.push(`/sites/${s.id}`)}
                style={cardBtn}
              >
                <div style={{ fontWeight: 900, fontSize: 16 }}>{s.id}</div>
                <div style={{ opacity: 0.85, marginTop: 6 }}>
                  template: <b>{s.template || "—"}</b> • created:{" "}
                  <b>{s.created_at ? new Date(s.created_at).toLocaleString() : "—"}</b>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
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

const shell: React.CSSProperties = {
  maxWidth: 920,
  margin: "0 auto",
  background: "rgba(255,255,255,0.10)",
  border: "1px solid rgba(255,255,255,0.18)",
  borderRadius: 18,
  padding: 18,
  boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
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

const cardBtn: React.CSSProperties = {
  textAlign: "left",
  width: "100%",
  padding: 14,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.10)",
  color: "white",
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



