import { headers } from "next/headers";

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

function getBaseUrlFromHeaders() {
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || "https";
  if (!host) return null;
  return `${proto}://${host}`;
}

async function fetchPublishedHtml(siteId: string, path: string) {
  const base = getBaseUrlFromHeaders();
  if (!base) return { html: null as string | null, debug: "Missing host headers" };

  // ✅ hard-bust any accidental CDN/runtime caching
  const t = Date.now();

  // Pass path through as a hint for future multi-page support (safe to ignore server-side)
  const url = `${base}/api/public/sites/${encodeURIComponent(siteId)}?t=${t}&path=${encodeURIComponent(path)}`;

  const res = await fetch(url, {
    cache: "no-store",
    headers: { "cache-control": "no-cache" },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { html: null as string | null, debug: `Public fetch failed (${res.status}): ${text.slice(0, 200)}` };
  }

  const json = await res.json().catch(() => null);
  const html = String(json?.html || "").trim();
  const updated_at = json?.updated_at ?? null;

  if (!html) {
    return { html: null as string | null, debug: `No published_html (updated_at: ${updated_at || "n/a"})` };
  }

  return { html, debug: `OK (updated_at: ${updated_at || "n/a"})` };
}

export default async function SitePage({ params }: PageProps) {
  const siteId = String(params.siteId || "");
  const path = normalizePath(params.slug);

  const { html, debug } = await fetchPublishedHtml(siteId, path);

  if (!html) {
    return (
      <main style={{ padding: 40, fontFamily: "system-ui" }}>
        <h1>Site not published yet</h1>
        <p>Click Publish in the Builder to push your site live.</p>
        <pre style={{ whiteSpace: "pre-wrap" }}>
siteId: {siteId}
path: {path}
debug: {debug}
        </pre>
      </main>
    );
  }

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}











