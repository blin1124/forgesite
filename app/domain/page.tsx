export const dynamic = "force-dynamic";

export default function DomainPage({
  searchParams,
}: {
  searchParams?: { siteId?: string };
}) {
  const siteId = String(searchParams?.siteId || "").trim();

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 28, fontWeight: 900 }}>Domain</h1>

      {!siteId ? (
        <>
          <p style={{ marginTop: 12 }}>
            Missing <code>siteId</code> in the URL.
          </p>
          <p style={{ marginTop: 8, opacity: 0.85 }}>
            Go back to Builder and click <b>Domain</b> on a site.
          </p>
          <a href="/builder" style={{ display: "inline-block", marginTop: 14 }}>
            ← Back to Builder
          </a>
        </>
      ) : (
        <>
          <p style={{ marginTop: 12 }}>
            Editing domain for site: <code>{siteId}</code>
          </p>
          <p style={{ marginTop: 8, opacity: 0.85 }}>
            (Next: show the connected domain, status, and DNS instructions here.)
          </p>
        </>
      )}
    </main>
  );
}










