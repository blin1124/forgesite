import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const body = await req.text();

  const res = await fetch(new URL("/api/stripe/checkout", req.url), {
    method: "POST",
    headers: {
      "content-type": req.headers.get("content-type") || "application/json",
      authorization: req.headers.get("authorization") || "",
    },
    body,
    cache: "no-store",
  });

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") || "application/json" },
  });
}











