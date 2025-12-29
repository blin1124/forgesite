import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { supabaseServer } from "@/lib/supabase-server";

async function isEntitled(): Promise<boolean> {
  try {
    // Call our own API route on the server
    const h = headers();
    const host = h.get("host");
    const proto = h.get("x-forwarded-proto") || "https";

    // In dev, host exists too (localhost:3000)
    const baseUrl = host ? `${proto}://${host}` : "";

    const res = await fetch(`${baseUrl}/api/entitlement`, {
      method: "GET",
      // IMPORTANT: forward cookies so the API can read the user session
      headers: {
        cookie: cookies().toString(),
      },
      cache: "no-store",
    });

    if (!res.ok) return false;

    const data = await res.json().catch(() => ({}));

    // Be defensive: support multiple shapes so we don't break
    if (typeof data?.entitled === "boolean") return data.entitled;
    if (typeof data?.isEntitled === "boolean") return data.isEntitled;
    if (typeof data?.active === "boolean") return data.active;

    // If the API returns something like { status: "active" }
    if (typeof data?.status === "string") {
      return ["active", "trialing", "paid"].includes(data.status.toLowerCase());
    }

    return false;
  } catch {
    return false;
  }
}

export default async function BuilderGatePage() {
  const supabase = supabaseServer(cookies());

  const { data } = await supabase.auth.getUser();

  // Not logged in -> login then come back
  if (!data?.user) {
    redirect(`/login?next=${encodeURIComponent("/builder")}`);
  }

  const entitled = await isEntitled();

  // Not paid -> billing
  if (!entitled) {
    redirect("/billing");
  }

  // Paid -> your real builder entry route
  // If your real builder page is /builder (actual UI), change this line to render it instead.
  redirect("/builder/site");
}

















