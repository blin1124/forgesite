import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY (server env var)");

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

async function fetchPublishedHtml(siteId: string) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("sites")
    .select("published_html, updated_at")
    .eq("id", siteId)
    .maybeSingle();

  if (error || !data) return null;

  const html = String(data.published_html || "").trim();
  return html ? html : null;
}

export default async function SitePage({ params }: PageProps) {
  const siteId = String(params.siteId || "").trim();
  const path = normalizePath(params.slug);

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
        <pre>
siteId: {siteId}
path: {path}
        </pre>
      </main>
    );
  }

  // Important: serve the published HTML as-is
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}










