import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const siteId = String(params?.id || "").trim();

  const { data, error } = await supabase
    .from("sites")
    .select("published_html, html, content")
    .eq("id", siteId)
    .maybeSingle();

  if (error || !data) {
    return new Response("Not found", { status: 404 });
  }

  const html = String(data.published_html || "").trim() || String(data.html || "").trim();
  if (!html) return new Response("No HTML", { status: 404 });

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
