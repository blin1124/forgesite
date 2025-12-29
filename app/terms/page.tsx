export const metadata = {
  title: "ForgeSite Terms of Service",
  description: "ForgeSite Terms of Service",
};

export default function TermsPage() {
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
            ForgeSite Terms of Service
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
          <b>Effective Date:</b> December 27, 2025
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
{`These Terms of Service (“Terms”) govern your access to and use of the Forgesite website, application,
and related services (collectively, the “Service”). By creating an account, subscribing, or otherwise using
the Service, you agree to be bound by these Terms. If you do not agree, do not use the Service.

1. Who We Are
“Forgesite,” “we,” “us,” or “our” refers to the operator of the Service (“Forgesite”). “You” refers to the
individual or entity using the Service.

2. The Service
Forgesite provides tools that allow customers to create, generate, publish, and manage websites and
related content. The Service may include AI-assisted features, templates, hosting integrations, and
billing/subscription functionality. We may add, remove, or modify features at any time.

3. Accounts and Security
You are responsible for maintaining the confidentiality of your account credentials and for all activity under
your account. You agree to provide accurate information and to promptly update it if it changes. We may
suspend or terminate accounts for security reasons or violations of these Terms.

4. Subscriptions, Billing, and Payments
Certain features require an active subscription. Subscription fees, billing frequency, and plan details are
shown at checkout. Taxes may apply. You are responsible for keeping payment information current.

5. Acceptable Use
You agree not to misuse the Service. You will not: (a) violate any law; (b) infringe or misappropriate
intellectual property; (c) upload malware or attempt to disrupt the Service; (d) attempt to gain unauthorized
access to systems; (e) reverse engineer or attempt to extract source code; (f) use the Service to create or
distribute unlawful, harmful, deceptive, or abusive content; or (g) use the Service in a way that interferes
with other users.

6. Your Content and Responsibility
You retain ownership of content you create or upload (“Customer Content”). You are solely responsible for
Customer Content, including ensuring you have all rights needed (e.g., licenses for images, logos, text,
and data). You represent and warrant that your Customer Content and use of the Service will not violate
law or third-party rights.

7. AI-Generated Output; No Guarantee
AI-assisted features may produce inaccurate or incomplete results. You are responsible for reviewing and
validating any output before publishing or relying on it. We do not guarantee that generated output is
unique, error-free, or suitable for your purpose.

8. Intellectual Property
We and our licensors own the Service, including software, templates, design elements, and trademarks.
Except for the limited right to use the Service as permitted by these Terms, no rights are granted. You may
not copy, sell, lease, or distribute the Service or any portion of it.

9. Third-Party Services
The Service may integrate with third-party providers (e.g., hosting, payments, domains). Your use of
third-party services is governed by their terms and policies. We are not responsible for third-party
services, downtime, or data handling by them.

10. Copyright / DMCA Notices
If you believe content available through the Service infringes your copyright, submit a notice using the
DMCA contact form at: https://www.dmca.com/Contact-Us.aspx

11. Legal Documents Provided as PDF
For convenience and clarity, certain legal policies may be provided as PDF documents (for example,
Privacy Policy). If a PDF does not render due to browser settings, you may download and view it locally.

12. Termination
You may stop using the Service at any time. We may suspend or terminate your access if you violate
these Terms, create risk for others, or for lawful compliance. Upon termination, your right to use the
Service ends. We may retain limited data as required for legal, accounting, or security purposes.

13. Disclaimers
THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE.” TO THE MAXIMUM EXTENT PERMITTED
BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO
NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE.

14. Limitation of Liability
TO THE MAXIMUM EXTENT PERMITTED BY LAW, FORGESITE WILL NOT BE LIABLE FOR ANY
INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF
PROFITS, REVENUE, DATA, OR GOODWILL, ARISING FROM OR RELATED TO YOUR USE OF THE
SERVICE. IN ALL CASES, OUR TOTAL LIABILITY WILL NOT EXCEED THE AMOUNTS YOU PAID TO
FORGESITE FOR THE SERVICE IN THE 12 MONTHS IMMEDIATELY PRECEDING THE EVENT
GIVING RISE TO THE CLAIM.

15. Indemnification
You agree to indemnify and hold harmless Forgesite from any claims, liabilities, damages, losses, and
expenses (including reasonable attorneys’ fees) arising out of or related to your Customer Content, your
use of the Service, or your violation of these Terms.

16. Changes to These Terms
We may update these Terms from time to time. If we make material changes, we may provide notice in the
Service. Your continued use of the Service after changes become effective means you accept the updated
Terms.

17. Governing Law; Venue
These Terms are governed by the laws of the State of Iowa, without regard to conflict of law principles.
Any dispute arising from these Terms or the Service will be brought in the state or federal courts located in
Iowa, and you consent to jurisdiction and venue in those courts.

18. Contact
For legal notices or questions about these Terms, contact us through channels provided within the Service
or via any support method we publish from time to time.`}
        </div>

        <div style={{ marginTop: 14, opacity: 0.8, fontSize: 13 }}>
          Tip: If you prefer this as a PDF instead, put the PDF in <code>/public</code> and link to it (e.g.{" "}
          <code>/Forgesite_Terms_of_Service.pdf</code>).
        </div>
      </div>
    </main>
  );
}
