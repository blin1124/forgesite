import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: {
    siteId: string;
    slug?: string[];
  };
};

function normalizePath(slug?: string[]) {
  if (!slug || slug.length === 0) return "/";
  return "/" + slug.join("/");
}

function getHostDebug() {
  const h = headers();
  return {
    host: h.get("host") || "",
    xfHost: h.get("x-forwarded-host") || "",
    xfProto: h.get("x-forwarded-proto") || "",
  };
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  // ✅ Service role so this works for customer domains (no auth cookies, no RLS issues)
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fetchPublishedHtml(siteId: string) {
  // ✅ IMPORTANT: Prefer published_html
  // If you don't have published_html yet, either:
  //  - add it, OR
  //  - change this to select("html")
  const { data, error } = await supabase
    .from("sites")
    .select("published_html, html")
    .eq("id", siteId)
    .maybeSingle();

  if (error) return null;

  // 1) prefer published_html
  const published = String((data as any)?.published_html || "").trim();
  if (published) return published;

  // 2) optional fallback to html (draft)
  // If you want STRICT publish-only behavior, delete this fallback.
  const draft = String((data as any)?.html || "").trim();
  return draft || null;
}

export default async function SitePage({ params }: PageProps) {
  const siteId = String(params.siteId || "").trim();
  const path = normalizePath(params.slug);

  if (!siteId) {
    return (
      <main style={{ padding: 40, fontFamily: "system-ui" }}>
        <h1>Missing siteId</h1>
      </main>
    );
  }

  const html = await fetchPublishedHtml(siteId);

  if (!html) {
    const dbg = getHostDebug();

    return (
      <main style={{ padding: 40, fontFamily: "system-ui" }}>
        <h1>Site not published yet</h1>
        <p>Click Publish in the Builder to push your site live.</p>

        <pre
          style={{
            background: "#111",
            color: "#0f0",
            padding: 12,
            borderRadius: 8,
            marginTop: 20,
          }}
        >
siteId: {siteId}
path: {path}

host: {dbg.host}
x-forwarded-host: {dbg.xfHost}
x-forwarded-proto: {dbg.xfProto}
        </pre>
      </main>
    );
  }

  return (
    <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: html }} />
  );
}







