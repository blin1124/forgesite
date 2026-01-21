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
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/public/sites/${siteId}`, {
    cache: "no-store",
  });

  // If NEXT_PUBLIC_BASE_URL is not set, Next will still resolve relative fetch in production
  if (!res.ok) return null;

  const json = await res.json();
  return String(json?.html || "") || null;
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






