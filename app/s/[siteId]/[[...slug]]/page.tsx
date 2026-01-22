import { notFound } from "next/navigation";

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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) return null;

  const res = await fetch(
    `${url}/rest/v1/sites?select=published_html&id=eq.${siteId}&limit=1`,
    {
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
      },
      cache: "no-store",
    }
  );

  if (!res.ok) return null;

  const json = await res.json();
  return json?.[0]?.published_html || null;
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









