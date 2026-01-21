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

async function fetchPublishedHtml(siteId: string) {
  // Use a RELATIVE fetch so it works on Vercel without any env var.
  const res = await fetch(`/api/public/sites/${encodeURIComponent(siteId)}`, {
    cache: "no-store",
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
        <p>Click Publish in the Builder to push your draft live.</p>
        <pre>
siteId: {siteId}
path: {path}
        </pre>
      </main>
    );
  }

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}







