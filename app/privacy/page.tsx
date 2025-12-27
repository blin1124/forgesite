export const dynamic = "force-dynamic";

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#0b1220", color: "white" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "18px 14px" }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Privacy Policy</h1>
        <p style={{ marginTop: 8, opacity: 0.8, fontSize: 13 }}>
          If your browser blocks embedded PDFs, use the download button.
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
          <a
            href="/legal/privacy.pdf"
            target="_blank"
            rel="noreferrer"
            style={btnStyle}
          >
            Open PDF
          </a>
          <a
            href="/legal/privacy.pdf"
            download
            style={btnStyle}
          >
            Download PDF
          </a>
        </div>

        <div
          style={{
            marginTop: 14,
            borderRadius: 14,
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.06)",
          }}
        >
          <iframe
            title="Privacy PDF"
            src="/legal/privacy.pdf"
            style={{ width: "100%", height: "78vh", border: "none", background: "white" }}
          />
        </div>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.10)",
  color: "white",
  fontWeight: 800,
  textDecoration: "none",
};
