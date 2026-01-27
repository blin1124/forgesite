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

function getBaseUrlFromHeadersSync() {
  // In Next, headers() is sync. Do NOT await it.
  const h = headers();

  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || "https";

  if (host) return `${proto}://${host}`;

  // Fallback if headers are missing
  const envBase = process.env.NEXT_PUBLIC_SITE_URL;
  if (envBase) return envBase;

  return null;
}

async function fetchPublishedHtml(siteId: string) {
  const base = getBaseUrlFromHeadersSync();
  if (!base) return null;

  const url = `${base}/api/public/sites/${encodeURIComponent(siteId)}?v=${Date.now()}`;

  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      "cache-control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      pragma: "no-cache",
      expires: "0",
    },
  });

  if (!res.ok) return null;

  const json = await res.json().catch(() => null);
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
      </main>
    );
  }

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

  // Optional: add a base tag so relative links/assets work when visiting /s/{id}/...
  // This helps if generated HTML uses relative URLs like "./style.css" or "/images/..."
  return (
    <html>
      <head>
        <base href={path.endsWith("/") ? path : path + "/"} />
        <meta httpEquiv="cache-control" content="no-store, no-cache, must-revalidate, proxy-revalidate" />
        <meta httpEquiv="pragma" content="no-cache" />
        <meta httpEquiv="expires" content="0" />
      </head>
      <body dangerouslySetInnerHTML={{ __html: html }} />
    </html>
  );
}








