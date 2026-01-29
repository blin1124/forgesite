// app/domain/page.tsx
export const dynamic = "force-dynamic";

export default function DomainPage({
  searchParams,
}: {
  searchParams?: { siteId?: string };
}) {
  const siteId = String(searchParams?.siteId || "").trim();

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>Connect Domain</h1>

      {!siteId ? (
        <>
          <p style={{ marginTop: 12 }}>
            Missing <code>siteId</code> in the URL.
          </p>
          <p style={{ marginTop: 8, opacity: 0.8 }}>
            Go back to the Builder and click the Domain button for a site.
          </p>

          <a
            href="/builder"
            style={{
              display: "inline-block",
              marginTop: 16,
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.15)",
              textDecoration: "none",
            }}
          >
            Back to Builder
          </a>
        </>
      ) : (
        <>
          <p style={{ marginTop: 12 }}>
            Site ID: <code>{siteId}</code>
          </p>
          <p style={{ marginTop: 8, opacity: 0.8 }}>
            This confirms the Domain button routing is fixed.
            Next we wire the actual domain linking UI here.
          </p>
        </>
      )}
    </main>
  );
}








