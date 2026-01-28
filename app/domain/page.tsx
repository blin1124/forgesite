// app/domain/page.tsx

import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function DomainPage() {
  const host = headers().get("host");

  if (!host) {
    return <h1>Domain not found</h1>;
  }

  const domain = host.replace("www.", "").toLowerCase();

  const { data: domainRow } = await supabase
    .from("custom_domains")
    .select("site_id")
    .eq("domain", domain)
    .eq("verified", true)
    .single();

  if (!domainRow?.site_id) {
    return <h1>Domain not linked</h1>;
  }

  const { data: site } = await supabase
    .from("sites")
    .select("html")
    .eq("id", domainRow.site_id)
    .single();

  if (!site?.html) {
    return <h1>Site not published</h1>;
  }

  return (
    <div
      dangerouslySetInnerHTML={{ __html: site.html }}
    />
  );
}






