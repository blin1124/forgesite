import Link from "next/link";

export const dynamic = "force-dynamic";

export default function ProSuccessPage({ searchParams }: { searchParams: { session_id?: string } }) {
  const sessionId = searchParams?.session_id || "";

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ maxWidth: 720, width: "100%" }}>
        <h1 style={{ fontSize: 32, fontWeight: 900 }}>Payment received ✅</h1>
        <p style={{ marginTop: 8 }}>
          Stripe is confirming your subscription. If you don’t get access immediately, wait ~10 seconds and try again.
        </p>

        <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href="/builder" style={btn}>Go to Builder</Link>
          <Link href="/billing" style={btn2}>Back to Billing</Link>
        </div>

        {sessionId ? (
          <p style={{ marginTop: 14, opacity: 0.7, fontSize: 12 }}>session_id: {sessionId}</p>
        ) : null}
      </div>
    </main>
  );
}

const btn: React.CSSProperties = {
  display: "inline-block",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.12)",
  background: "black",
  color: "white",
  fontWeight: 800,
  textDecoration: "none",
};

const btn2: React.CSSProperties = {
  display: "inline-block",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.12)",
  background: "white",
  color: "black",
  fontWeight: 800,
  textDecoration: "none",
};
