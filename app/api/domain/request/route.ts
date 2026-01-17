import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { domain } = await req.json();

    if (!domain) {
      return NextResponse.json(
        { error: "Missing domain" },
        { status: 400 }
      );
    }

    /**
     * These DNS records work for:
     * - GoDaddy
     * - Namecheap
     * - Ionos
     * - Google Domains
     * - Cloudflare
     */

    const dns_records = [
      {
        type: "A",
        name: "@",
        value: "76.76.21.21",
        ttl: 600,
      },
      {
        type: "CNAME",
        name: "www",
        value: "cname.vercel-dns.com",
        ttl: 600,
      },
    ];

    return NextResponse.json({
      ok: true,
      domain,
      dns_records,
      instructions:
        "Add these DNS records at your domain registrar, wait 1–10 minutes, then click Verify DNS.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Request failed" },
      { status: 500 }
    );
  }
}







