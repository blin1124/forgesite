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

async function fetchPublishedHtml(siteId: string) {
  const base = getBaseUrlFromHeaders();
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
  const siteId = params.siteId;
  const path = normalizePath(params.slug);

  const html = await fetchPublishedHtml(siteId);

  if (!html) {
    return (
      <main style={{ padding: 40, fontFamily: "system-ui" }}>
        <h1>Site not published yet</h1>
        <p>Click Publish in the Builder to push your site live.</p>
        <pre>
siteId: {siteId}
path: {path}
        </pre>
      </main>
    );
  }

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}










