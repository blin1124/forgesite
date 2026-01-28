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

function getBaseUrl() {
  const h = headers();

  const host =
    h.get("x-forwarded-host") ||
    h.get("host");

  const proto =
    h.get("x-forwarded-proto") || "https";

  if (host) return `${proto}://${host}`;

  // absolute fallback
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }

  return null;
}

async function fetchPublishedHtml(siteId: string) {
  const base = getBaseUrl();
  if (!base) return null;

  const url =
    `${base}/api/public/sites/${encodeURIComponent(siteId)}?v=${Date.now()}`;

  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      "cache-control": "no-store, no-cache, must-revalidate",
      pragma: "no-cache",
    },
  });

  if (!res.ok) return null;

  const json = await res.json();

  const html = String(json?.html || "").trim();

  return html || null;
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
        </pre>
      </main>
    );
  }

  return (
    <div
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}







