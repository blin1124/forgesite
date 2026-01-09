import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/builder";

  // If no code, just go back to login.
  if (!code) {
    const back = new URL(`/login?next=${encodeURIComponent(next)}`, url.origin);
    return NextResponse.redirect(back);
  }

  const supabaseUrl = mustEnv("SUPABASE_URL");
  const anonKey = mustEnv("SUPABASE_ANON_KEY");

  // Exchange the auth code for a Supabase session and set cookies.
  const supabase = createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data?.session) {
    const back = new URL(`/login?next=${encodeURIComponent(next)}`, url.origin);
    back.searchParams.set("error", "oauth_failed");
    return NextResponse.redirect(back);
  }

  // Set Supabase auth cookies manually (simple approach).
  // If you’re using @supabase/ssr helpers elsewhere, you can swap to that later.
  const res = NextResponse.redirect(new URL(next, url.origin));

  // Store access token and refresh token as HttpOnly cookies
  // Names are intentionally app-specific; your API can read these if needed.
  res.cookies.set("sb-access-token", data.session.access_token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  });
  res.cookies.set("sb-refresh-token", data.session.refresh_token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  });

  return res;
}



