import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

type SiteRow = {
  id: string;
  html: string | null;
  name: string | null;
};

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function supabaseFromRequest() {
  const h = headers();

  // For Next App Router + @supabase/ssr
  // We wire cookies through the server client; the middleware already sets them.
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => h.get("cookie")?.match(new RegExp(`${name}=([^;]+)`))?.[1],
        set: () => {},
        remove: () => {},
      },
    }
  );
}

async function requireUser() {
  const sb = supabaseFromRequest();
  const { data } = await sb.auth.getUser();
  const user = data?.user;
  if (!user) {
    redirect("/login?next=/sites");
  }
  return user;
}

async function getSiteById(id: string): Promise<SiteRow | null> {
  // Use admin read so internal preview never depends on user cookies
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("sites")
    .select("id, html, name")
    .eq("id", id)
    .maybeSingle();

  if (error) return null;
  return (data as SiteRow) ?? null;
}

export default async function SiteOpenPage({ params }: { params: { id: string } }) {
  const id = params?.id;
  if (!id) notFound();

  // Require login for /site/<id>
  await requireUser();

  const site = await getSiteById(id);
  if (!site?.html) notFound();

  return (
    <div style={{ width: "100vw", height: "100vh", margin: 0 }}>
      <iframe
        srcDoc={site.html}
        title={site.name || "Site"}
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          display: "block",
          background: "white",
        }}
      />
    </div>
  );
}








