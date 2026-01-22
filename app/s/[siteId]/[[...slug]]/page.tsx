type PageProps = {
  params: {
    siteId: string;
    slug?: string[];
  };
};

async function fetchPublishedHtml(siteId: string) {
  // Relative fetch works on Vercel
  const res = await fetch(`/api/public/sites/${encodeURIComponent(siteId)}`, {
    cache: "no-store",
  });

  if (!res.ok) return null;

  const json = await res.json();
  const html = String(json?.html || "");
  return html.trim() ? html : null;
}

export default async function SitePage({ params }: PageProps) {
  const siteId = String(params.siteId || "").trim();
  const html = await fetchPublishedHtml(siteId);

  if (!html) {
    return (
      <main style={{ padding: 40, fontFamily: "system-ui" }}>
        <h1>Site not published yet</h1>
        <p>Click Publish in the Builder to push your site live.</p>
        <pre>siteId: {siteId}</pre>
      </main>
    );
  }

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}









