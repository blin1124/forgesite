import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

/**
 * Supabase redirects here after login with:
 *   /auth/callback?code=...&next=/builder
 *
 * We exchange the `code` for a session and then redirect to `next`.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/builder";

  if (!code) {
    // No code -> send to login
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, url.origin));
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return NextResponse.redirect(
      new URL(`/login?next=${encodeURIComponent(next)}&error=${encodeURIComponent("Missing SUPABASE_URL or SUPABASE_ANON_KEY")}`, url.origin)
    );
  }

  // IMPORTANT: we do a server-side code exchange, then set cookies manually
  // using the "PKCE exchange" endpoint. Supabase-js needs a cookie adapter in Next.
  // Easiest reliable approach: call Supabase token endpoint directly.

  // If your project uses the official @supabase/ssr helpers, use them instead.
  // But this version works as long as SUPABASE_URL + SUPABASE_ANON_KEY exist.

  const tokenUrl = `${supabaseUrl}/auth/v1/token?grant_type=pkce`;
  const resp = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "apikey": anonKey,
      "authorization": `Bearer ${anonKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ auth_code: code }),
  });

  if (!resp.ok) {
    const msg = await resp.text().catch(() => "");
    return NextResponse.redirect(
      new URL(`/login?next=${encodeURIComponent(next)}&error=${encodeURIComponent("Auth exchange failed: " + msg.slice(0, 120))}`, url.origin)
    );
  }

  const data = await resp.json();
  const access_token = data?.access_token;
  const refresh_token = data?.refresh_token;

  if (!access_token || !refresh_token) {
    return NextResponse.redirect(
      new URL(`/login?next=${encodeURIComponent(next)}&error=${encodeURIComponent("Missing tokens from exchange")}`, url.origin)
    );
  }

  // Supabase stores session in cookies. We'll set the standard sb- cookies.
  // Cookie names vary by project; simplest is to set the `sb-access-token` style.
  // If your project already had cookies working previously, this will restore session persistence.

  const res = NextResponse.redirect(new URL(next, url.origin));

  // HTTP-only cookies for session
  res.cookies.set("sb-access-token", access_token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  });

  res.cookies.set("sb-refresh-token", refresh_token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  });

  return res;
}
