// app/s/[id]/page.tsx
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalizeHtml(row: any): string {
  const html = row?.html;
  if (typeof html === "string" && html.trim().length > 0) return html;

  const content = row?.content;
  if (typeof content === "string" && content.trim().length > 0) {
    const t = content.trim();
    if (t.startsWith("{") || t.startsWith("[")) {
      try {
        const parsed = JSON.parse(t);
        if (typeof parsed === "string") return parsed;
        if (typeof parsed?.html === "string") return parsed.html;
        if (typeof parsed?.content === "string") return parsed.content;
      } catch {
        return content;
      }
    }
    return content;
  }

  return "";
}

export default async function SharedSitePage({ params }: { params: { id: string } }) {
  const id = params?.id;

  if (!id) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui" }}>
        <h1 style={{ fontSize: 18, fontWeight: 700 }}>Missing site id</h1>
        <p>/s/[id] did not receive an id param.</p>
      </div>
    );
  }

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("sites")
    .select("id, html, content, template, created_at")
    .eq("id", id)
    .maybeSingle();

  // IMPORTANT: do NOT 404 here — show what happened.
  if (error) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui" }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "#b91c1c" }}>Supabase error loading site</h1>
        <p style={{ marginTop: 8 }}>
          This is usually an <b>RLS policy</b> blocking the anon key.
        </p>
        <pre
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            background: "#111827",
            color: "white",
            overflow: "auto",
            fontSize: 12,
          }}
        >
{JSON.stringify(
  {
    message: error.message,
    details: (error as any).details,
    hint: (error as any).hint,
    code: (error as any).code,
    id,
  },
  null,
  2
)}
        </pre>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui" }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "#b45309" }}>No row returned for this id</h1>
        <p style={{ marginTop: 8 }}>
          If you can see this row in Supabase Table Editor but it returns null here, it’s <b>RLS</b>.
        </p>
        <p style={{ marginTop: 8 }}>
          Site ID: <code>{id}</code>
        </p>
      </div>
    );
  }

  const html = normalizeHtml(data);

  if (!html) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui" }}>
        <h1 style={{ fontSize: 18, fontWeight: 700 }}>Site loaded, but no HTML found</h1>
        <p style={{ marginTop: 8 }}>
          I found the row, but <code>html</code> (and <code>content</code>) is empty.
        </p>
        <pre
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            background: "#111827",
            color: "white",
            overflow: "auto",
            fontSize: 12,
          }}
        >
{JSON.stringify(data, null, 2)}
        </pre>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f3f4f6" }}>
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "rgba(255,255,255,0.9)",
          backdropFilter: "blur(10px)",
          borderBottom: "1px solid rgba(0,0,0,0.08)",
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ fontWeight: 700 }}>ForgeSite</div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <a
              href={`/site/${id}`}
              style={{
                fontSize: 13,
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.12)",
                background: "white",
                textDecoration: "none",
                color: "#111827",
              }}
            >
              Open in app
            </a>

            <a
              href="/signup"
              style={{
                fontSize: 13,
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.12)",
                background: "white",
                textDecoration: "none",
                color: "#111827",
              }}
            >
              Create your own
            </a>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: 14 }}>
        <div
          style={{
            borderRadius: 14,
            overflow: "hidden",
            background: "white",
            boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
            border: "1px solid rgba(0,0,0,0.08)",
          }}
        >
          <div dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </div>
    </div>
  );
}





