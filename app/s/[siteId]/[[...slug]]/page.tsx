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

async function fetchPublishedPage(siteId: string, path: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;

  const res = await fetch(
    `${url}/rest/v1/site_pages?select=html&site_id=eq.${siteId}&path=eq.${encodeURIComponent(
      path
    )}&limit=1`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      cache: "no-store",
    }
  );

  if (!res.ok) return null;

  const json = await res.json();
  return json?.[0]?.html || null;
}

export default async function SitePage({ params }: PageProps) {
  const siteId = params.siteId;
  const path = normalizePath(params.slug);

  const html = await fetchPublishedPage(siteId, path);

  if (!html) {
    return (
      <main style={{ padding: 40, fontFamily: "system-ui" }}>
        <h1>Site not published yet</h1>
        <p>
          Domain is connected but no published content exists for:
        </p>
        <pre>
siteId: {siteId}
path: {path}
        </pre>
      </main>
    );
  }

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

