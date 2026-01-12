import React from "react";
import { headers } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function HostedDomainPage() {
  const h = headers();
  const host = (h.get("x-forwarded-host") || h.get("host") || "").toLowerCase();

  // If you want, you can also read path/query here later.
  const supabaseAdmin = getSupabaseAdmin();

  // Adjust columns/table names to your schema.
  // This is a safe default lookup:
  const { data, error } = await supabaseAdmin
    .from("custom_domains")
    .select("domain, site_id, verified, status, target")
    .eq("domain", host)
    .maybeSingle();

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 24,
        background: "#0b0b0f",
        color: "white",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
      }}
    >
      <div
        style={{
          maxWidth: 900,
          margin: "0 auto",
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.06)",
          borderRadius: 16,
          padding: 16,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>
          Hosted Domain Resolver
        </h1>

        <p style={{ opacity: 0.9, marginTop: 8 }}>
          Incoming host: <b>{host || "(missing host header)"}</b>
        </p>

        {error ? (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 12,
              background: "rgba(185, 28, 28, .25)",
              border: "1px solid rgba(185, 28, 28, .5)",
              whiteSpace: "pre-wrap",
            }}
          >
            <b>Supabase error:</b> {error.message}
          </div>
        ) : !data ? (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 12,
              background: "rgba(0,0,0,0.25)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            No custom domain record found for this host yet.
          </div>
        ) : (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 12,
              background: "rgba(0,0,0,0.25)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <div>
              <b>domain:</b> {data.domain}
            </div>
            <div>
              <b>site_id:</b> {String((data as any).site_id || "")}
            </div>
            <div>
              <b>verified:</b> {String((data as any).verified ?? "")}
            </div>
            <div>
              <b>status:</b> {String((data as any).status ?? "")}
            </div>
            <div>
              <b>target:</b> {String((data as any).target ?? "")}
            </div>

            <p style={{ opacity: 0.85, marginTop: 10 }}>
              Next step (later): render the customer site HTML for this site_id.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}



