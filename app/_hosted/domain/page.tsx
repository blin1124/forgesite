import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export default async function HostedCustomDomainPage({
  searchParams,
}: {
  searchParams: { d?: string };
}) {
  const domain = String(searchParams?.d || "").toLowerCase().trim();
  const admin = supabaseAdmin();

  if (!domain) {
    return (
      <main style={{ padding: 40, fontFamily: "system-ui" }}>
        <h1>Missing domain</h1>
      </main>
    );
  }

  const { data: cd } = await admin
    .from("custom_domains")
    .select("site_id, verified, status")
    .eq("domain", domain)
    .maybeSingle();

  if (!cd?.site_id) {
    return (
      <main style={{ padding: 40, fontFamily: "system-ui" }}>
        <h1>Domain not connected</h1>
        <p>{domain}</p>
      </main>
    );
  }

  const { data: site } = await admin
    .from("sites")
    .select("html")
    .eq("id", cd.site_id)
    .maybeSingle();

  if (!site?.html) {
    return (
      <main style={{ padding: 40, fontFamily: "system-ui" }}>
        <h1>Site not found</h1>
        <p>Domain: {domain}</p>
      </main>
    );
  }

  return (
    <html>
      <head />
      <body dangerouslySetInnerHTML={{ __html: site.html }} />
    </html>
  );
}


