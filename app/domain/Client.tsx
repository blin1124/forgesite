"use client";

import React from "react";
import { useRouter } from "next/navigation";
import CustomDomainCard from "@/components/CustomDomainCard";

export default function DomainClient() {
  const router = useRouter();

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        color: "white",
        background:
          "radial-gradient(1200px 600px at 20% 0%, rgba(255,255,255,0.18), transparent 60%), linear-gradient(135deg, rgb(124,58,237) 0%, rgb(109,40,217) 35%, rgb(91,33,182) 100%)",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
      }}
    >
      <div style={{ width: "min(980px, 92vw)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 14 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>Custom Domain</h1>
            <p style={{ marginTop: 6, opacity: 0.9 }}>
              Connect your domain after your site is ready.
            </p>
          </div>

          <button
            onClick={() => router.push("/builder")}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.22)",
              background: "rgba(255,255,255,0.12)",
              color: "white",
              fontWeight: 900,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            ← Back to Builder
          </button>
        </div>

        <CustomDomainCard />
      </div>
    </main>
  );
}
