"use client";

import { useMemo } from "react";

export default function ShareBar({
  id,
  publicUrl,
}: {
  id: string;
  publicUrl: string;
}) {
  const shareUrl = useMemo(() => publicUrl, [publicUrl]);

  async function copyLink() {
    await navigator.clipboard.writeText(shareUrl);
    alert("Share link copied!");
  }

  function openPublic() {
    window.open(shareUrl, "_blank", "noopener,noreferrer");
  }

  function backToSites() {
    window.location.href = "/sites";
  }

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        padding: "12px 16px",
        background: "white",
        borderBottom: "1px solid rgba(0,0,0,0.08)",
        display: "flex",
        gap: 10,
        alignItems: "center",
      }}
    >
      <button onClick={backToSites} style={btnStyle}>
        ← Back to Sites
      </button>

      <button onClick={copyLink} style={btnStyle}>
        Copy Share Link
      </button>

      <button onClick={openPublic} style={btnStyle}>
        Open Public Share
      </button>

      <span style={{ marginLeft: "auto", opacity: 0.7, fontSize: 12 }}>
        Site ID: {id}
      </span>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.12)",
  background: "white",
  cursor: "pointer",
  fontWeight: 600,
};

