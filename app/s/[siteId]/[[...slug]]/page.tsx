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

async function getBaseUrlFromHeaders() {
  const h = await headers();

  const host = h.get("x-forwarded-host") || h.get("host");
  // If your proxy doesn’t send x-forwarded-proto, default to https.
  const proto = h.get("x-forwarded-proto") || "https";

  if (host) return `${proto}://${host}`;

  // ✅ Fallback if headers are missing (rare, but can happen)
  const envBase = process.env.NEXT_PUBLIC_SITE_URL;
  if (envBase) return envBase;

  return null;
}

async function fetchPublishedHtml(siteId: string) {
  const base = await getBaseUrlFromHeaders();
  if (!base) return null;

  const res = await fetch(`${base}/api/public/sites/${encodeURIComponent(siteId)}`, {
    cache: "no-store",
    headers: { "cache-control": "no-cache" },
  });

  if (!res.ok) return null;

  const json = await res.json();
  const html = String(json?.html || "");
  return html.trim() ? html : null;
}

export default async function SitePage({ params }: PageProps) {
  const siteId = String(params.siteId || "").trim();
  const path = normalizePath(params.slug);

  const html = await fetchPublishedHtml(siteId);

  if (!html) {
    return (
      <main style={{ padding: 40, fontFamily: "system-ui" }}>
        <h1>Site not published yet</h1>
        <p>Click Publish in the Builder to push your site live.</p>
        <pre style={{ background: "#111", color: "#fff", padding: 12, borderRadius: 8 }}>
siteId: {siteId}
path: {path}
        </pre>
      </main>
    );
  }

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}









