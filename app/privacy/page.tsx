export const metadata = {
  title: "ForgeSite Privacy Policy",
  description: "ForgeSite Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "28px 18px 60px",
        background:
          "radial-gradient(1200px 600px at 20% 0%, rgba(255,255,255,0.10), transparent 60%), linear-gradient(135deg, rgb(17,24,39) 0%, rgb(0,0,0) 100%)",
        color: "white",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900, letterSpacing: -0.4 }}>
            ForgeSite Privacy Policy
          </h1>
          <a
            href="/billing"
            style={{
              textDecoration: "none",
              color: "white",
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.08)",
              padding: "10px 12px",
              borderRadius: 12,
              fontWeight: 800,
              height: "fit-content",
            }}
          >
            Back to Billing
          </a>
        </div>

        <p style={{ opacity: 0.85, marginTop: 10 }}>
          <b>Last updated:</b> January 1, 2026
        </p>

        <div
          style={{
            marginTop: 16,
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.14)",
            borderRadius: 16,
            padding: 18,
            lineHeight: 1.55,
            whiteSpace: "pre-wrap",
          }}
        >
{`1. Introduction
Forgesite (“we,” “our,” or “us”) respects your privacy and is committed to protecting the personal
information you share with us. This Privacy Policy explains how we collect, use, disclose, and
safeguard your information when you use the Forgesite platform, which allows customers to create and
manage their own websites.

2. Information We Collect
We may collect the following types of information:
• Personal Information: Name, email address, billing details, and account credentials.
• Website Content: Text, images, code, and other content you upload or generate using Forgesite.
• Usage Data: IP address, browser type, device information, pages visited, and feature usage.
• Payment Information: Processed securely through third-party payment processors. We do not
store full payment card details.

3. How We Use Your Information
We use your information to:
• Provide, operate, and maintain the Forgesite platform.
• Create and manage your account.
• Process transactions and send related communications.
• Improve our services, features, and user experience.
• Communicate with you regarding updates, security, and support.
• Comply with legal obligations and enforce our terms.

4. How We Share Information
We do not sell your personal data. We may share information only in the following situations:
• With service providers who help us operate our platform (hosting, analytics, payments).
• To comply with legal requirements or respond to lawful requests.
• To protect the rights, safety, and property of Forgesite, our users, or others.
• In connection with a business transfer such as a merger or acquisition.

5. Data Security
We implement reasonable administrative, technical, and physical safeguards to protect your
information. However, no method of transmission over the Internet or electronic storage is 100%
secure.

6. Data Retention
We retain your information only for as long as necessary to fulfill the purposes described in this policy,
unless a longer retention period is required or permitted by law.

7. Your Rights and Choices
Depending on your location, you may have rights to access, correct, or delete your personal
information, or to object to certain processing activities.

8. Third-Party Services
Forgesite may contain links to third-party websites or services. We are not responsible for the privacy
practices of those third parties.

9. Children’s Privacy
Forgesite is not intended for children under the age of 13. We do not knowingly collect personal
information from children.

10. Changes to This Policy
We may update this Privacy Policy from time to time. Any changes will be posted with an updated
effective date.`}
        </div>
      </div>
    </main>
  );
}
