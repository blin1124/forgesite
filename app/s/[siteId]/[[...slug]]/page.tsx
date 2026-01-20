import { notFound } from "next/navigation";

type PageProps = {
  params: { siteId: string; slug?: string[] };
};

async function fetchPublishedHtml(siteId: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;

  const res = await fetch(
    `${url}/rest/v1/sites?select=published_html,content&id=eq.${encodeURIComponent(siteId)}&limit=1`,
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
  const row = json?.[0];
  if (!row) return null;

  // only render if published
  if (String(row.content || "").toLowerCase() !== "published") return null;

  return row.published_html || null;
}

export default async function SitePage({ params }: PageProps) {
  const siteId = params.siteId;

  const html = await fetchPublishedHtml(siteId);

  if (!html) {
    return (
      <main style={{ padding: 40, fontFamily: "system-ui" }}>
        <h1>Site not published yet</h1>
        <p>Click Publish in the Builder to push your draft live.</p>
        <pre>siteId: {siteId}</pre>
      </main>
    );
  }

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}





