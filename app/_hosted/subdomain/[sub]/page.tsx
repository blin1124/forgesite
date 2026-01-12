import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function looksLikeUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export default async function HostedSubdomainPage({
  params,
}: {
  params: { sub: string };
}) {
  const sub = (params.sub || "").toLowerCase();
  const admin = supabaseAdmin();

  // 1) Try sites.subdomain
  const bySub = await admin
    .from("sites")
    .select("id, html")
    .eq("subdomain", sub)
    .maybeSingle();

  if (bySub.data?.html) {
    return <HtmlDoc html={bySub.data.html} />;
  }

  // 2) If sub is uuid, treat as site id
  if (looksLikeUuid(sub)) {
    const byId = await admin.from("sites").select("id, html").eq("id", sub).maybeSingle();
    if (byId.data?.html) return <HtmlDoc html={byId.data.html} />;
  }

  // Not found
  return (
    <main style={{ padding: 40, fontFamily: "system-ui" }}>
      <h1>Site not found</h1>
      <p>Subdomain: <b>{sub}</b></p>
    </main>
  );
}

function HtmlDoc({ html }: { html: string }) {
  return (
    <html>
      <head />
      <body dangerouslySetInnerHTML={{ __html: html }} />
    </html>
  );
}
