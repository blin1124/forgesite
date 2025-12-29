// app/page.tsx
import Link from "next/link";

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(135deg, rgb(106, 90, 249), rgb(157, 88, 255), rgb(192, 87, 247))",
        padding: "48px 24px",
        color: "white",
      }}
    >
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <h1
          style={{
            fontSize: 52,
            fontWeight: 800,
            lineHeight: 1.05,
            textAlign: "center",
            marginTop: 10,
          }}
        >
          ForgeSite AI — Premium Website Builder
        </h1>

        <p style={{ textAlign: "center", opacity: 0.9, marginTop: 14 }}>
          Generate fully functional websites using AI — instantly.
        </p>

        <div
          style={{
            marginTop: 40,
            maxWidth: 820,
            marginLeft: "auto",
            marginRight: "auto",
            background: "rgba(255,255,255,0.10)",
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: 18,
            padding: 26,
            boxShadow: "0 18px 60px rgba(0,0,0,0.18)",
          }}
        >
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>
            Before you generate your first site
          </h2>

          <p style={{ opacity: 0.92, lineHeight: 1.6 }}>
            This product uses a <b>BYOK (Bring Your Own Key)</b> setup. That means you paste your
            own <b>OpenAI API key</b> so the AI requests run on your OpenAI account.
          </p>

          <ul style={{ marginTop: 14, paddingLeft: 18, lineHeight: 1.7, opacity: 0.92 }}>
            <li>
              <b>Why you need a key:</b> OpenAI requires an API key to authorize requests.
            </li>
            <li>
              <b>Billing:</b> OpenAI usage is billed by OpenAI to the account that owns the key.
            </li>
            <li>
              <b>Keep it private:</b> Treat your API key like a password. Don’t share it publicly.
            </li>
          </ul>

          <div style={{ display: "flex", gap: 12, marginTop: 18, flexWrap: "wrap" }}>
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 14px",
                borderRadius: 12,
                background: "rgba(255,255,255,0.92)",
                color: "rgb(85, 40, 150)",
                fontWeight: 800,
                textDecoration: "none",
              }}
            >
              Get an OpenAI API key →
            </a>

            {/* ✅ THIS IS THE FIX: always go to billing first */}
            <Link
              href="/billing"
              prefetch={false}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 14px",
                borderRadius: 12,
                background: "rgba(255,255,255,0.18)",
                border: "1px solid rgba(255,255,255,0.25)",
                color: "white",
                fontWeight: 800,
                textDecoration: "none",
              }}
            >
              Go to Builder →
            </Link>
          </div>

          <p style={{ opacity: 0.75, marginTop: 14, fontSize: 13, lineHeight: 1.5 }}>
            You must subscribe before accessing the Builder. Public share links (/s/&lt;id&gt;) stay public.
          </p>
        </div>

        {/* Domain instructions */}
        <div
          style={{
            marginTop: 18,
            maxWidth: 820,
            marginLeft: "auto",
            marginRight: "auto",
            background: "rgba(255,255,255,0.10)",
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: 18,
            padding: 26,
            boxShadow: "0 18px 60px rgba(0,0,0,0.18)",
          }}
        >
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>
            Custom domain (what customers expect)
          </h2>
          <p style={{ opacity: 0.92, lineHeight: 1.6 }}>
            When you finish designing your site, you can connect your own domain (like{" "}
            <b>yourbusiness.com</b>). You’ll buy the domain from a registrar, then connect it inside
            ForgeSite.
          </p>

          <ul style={{ marginTop: 14, paddingLeft: 18, lineHeight: 1.7, opacity: 0.92 }}>
            <li>
              <b>Step 1:</b> Buy a domain from GoDaddy, IONOS, Namecheap, etc.
            </li>
            <li>
              <b>Step 2:</b> In ForgeSite, you’ll enter the domain and we’ll show you the DNS
              records to add.
            </li>
            <li>
              <b>Step 3:</b> DNS can take a little while to update (often minutes, sometimes longer).
            </li>
          </ul>

          <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
            <a
              href="https://www.godaddy.com/domains"
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "10px 14px",
                borderRadius: 12,
                background: "rgba(255,255,255,0.18)",
                border: "1px solid rgba(255,255,255,0.25)",
                color: "white",
                fontWeight: 800,
                textDecoration: "none",
              }}
            >
              Buy on GoDaddy →
            </a>
            <a
              href="https://www.ionos.com/domains"
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "10px 14px",
                borderRadius: 12,
                background: "rgba(255,255,255,0.18)",
                border: "1px solid rgba(255,255,255,0.25)",
                color: "white",
                fontWeight: 800,
                textDecoration: "none",
              }}
            >
              Buy on IONOS →
            </a>
            <a
              href="https://www.namecheap.com/domains/"
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "10px 14px",
                borderRadius: 12,
                background: "rgba(255,255,255,0.18)",
                border: "1px solid rgba(255,255,255,0.25)",
                color: "white",
                fontWeight: 800,
                textDecoration: "none",
              }}
            >
              Buy on Namecheap →
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}





