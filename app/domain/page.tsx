"use client";

import { useSearchParams, useRouter } from "next/navigation";
import React from "react";

export default function DomainPage() {
  const sp = useSearchParams();
  const router = useRouter();

  const siteId = sp.get("siteId") || "";

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>Connect Domain</h1>

      {!siteId ? (
        <>
          <p style={{ marginTop: 12 }}>Missing <code>siteId</code> in URL.</p>
          <button
            style={{ marginTop: 16, padding: "10px 14px", borderRadius: 10, cursor: "pointer" }}
            onClick={() => router.push("/builder")}
          >
            Back to Builder
          </button>
        </>
      ) : (
        <>
          <p style={{ marginTop: 12 }}>
            Site ID: <code>{siteId}</code>
          </p>
          <p style={{ marginTop: 8, opacity: 0.8 }}>
            (This is the correct page for your Builder “Domain” button. Next we wire your actual domain linking UI here.)
          </p>
        </>
      )}
    </main>
  );
}







