import Link from "next/link";

export const runtime = "nodejs";

export default function LoginPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 16,
        color: "white",
        background:
          "radial-gradient(1200px 600px at 20% 0%, rgba(255,255,255,0.18), transparent 60%), linear-gradient(135deg, rgb(124,58,237) 0%, rgb(109,40,217) 35%, rgb(91,33,182) 100%)",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
        display: "grid",
        placeItems: "center",
      }}
    >
      <div
        style={{
          width: "min(720px, 100%)",
          background: "rgba(255,255,255,0.12)",
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: 18,
          padding: 18,
          boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
        }}
      >
        <div style={{ fontSize: 44, fontWeight: 900, lineHeight: 1 }}>Login</div>
        <div style={{ opacity: 0.9, marginTop: 8 }}>
          Sign in to access the Builder.
        </div>

        <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a
            href="/auth"
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.92)",
              color: "rgb(85, 40, 150)",
              fontWeight: 900,
              cursor: "pointer",
              textDecoration: "none",
            }}
          >
            Continue
          </a>

          <Link
            href="/"
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.25)",
              background: "rgba(255,255,255,0.14)",
              color: "white",
              fontWeight: 900,
              cursor: "pointer",
              textDecoration: "none",
            }}
          >
            Back to home
          </Link>
        </div>

        <div style={{ marginTop: 14, opacity: 0.8, fontSize: 13 }}>
          If you intended to handle OAuth here, that logic belongs in{" "}
          <code>app/auth/callback/route.ts</code>, not this page.
        </div>
      </div>
    </main>
  );
}








