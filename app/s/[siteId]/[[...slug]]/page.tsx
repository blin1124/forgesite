import { headers } from "next/headers";

export const runtime = "nodejs";
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

async function fetchPublishedHtml(siteId: string) {
  const base = getBaseUrlFromHeaders();
  if (!base) return null;

  // ✅ cache buster so even intermediaries/proxies don’t serve stale
  const url = `${base}/api/public/sites/${encodeURIComponent(siteId)}?v=${Date.now()}`;

  const res = await fetch(url, {
    cache: "no-store",
    // extra “do not cache” signals
    headers: {
      "cache-control": "no-cache, no-store, must-revalidate",
      pragma: "no-cache",
    },
  });

  if (!res.ok) return null;

  const json = await res.json();
  const html = String(json?.html || "");
  return html.trim() ? html : null;
}

export default async function SitePage({ params }: PageProps) {
  const siteId = String(params?.siteId || "").trim();
  const path = normalizePath(params?.slug);

  if (!siteId) {
    return (
      <main style={{ padding: 40, fontFamily: "system-ui" }}>
        <h1>Missing siteId</h1>
        <p>This URL is invalid.</p>
      </main>
    );
  }

  const html = await fetchPublishedHtml(siteId);

  if (!html) {
    return (
      <main style={{ padding: 40, fontFamily: "system-ui" }}>
        <h1>Site not published yet</h1>
        <p>Click Publish in the Builder to push your site live.</p>
        <pre style={{ marginTop: 16, padding: 12, background: "#f3f4f6", borderRadius: 12 }}>
siteId: {siteId}
path: {path}
        </pre>
      </main>
    );
  }

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}









