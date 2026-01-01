"use client";

import React from "react";

export default function CustomDomainCard() {
  return (
    <section style={wrap}>
      <h2 style={title}>Custom domain (what customers expect)</h2>

      <p style={desc}>
        When you finish designing your site, you can connect your own domain (like{" "}
        <b>yourbusiness.com</b>). You&apos;ll buy the domain from a registrar, then connect it inside ForgeSite.
      </p>

      <div style={steps}>
        <div style={step}>
          <span style={stepLabel}>Step 1:</span> Buy a domain from GoDaddy, IONOS, Namecheap, etc.
        </div>
        <div style={step}>
          <span style={stepLabel}>Step 2:</span> In ForgeSite, you&apos;ll enter the domain and we&apos;ll show you the DNS records to add.
        </div>
        <div style={step}>
          <span style={stepLabel}>Step 3:</span> DNS can take a little while to update (often minutes, sometimes longer).
        </div>
      </div>

      <div style={btnRow}>
        <a
          href="https://www.godaddy.com/"
          target="_blank"
          rel="noreferrer"
          style={btn}
        >
          Buy on GoDaddy →
        </a>

        <a
          href="https://www.ionos.com/domains"
          target="_blank"
          rel="noreferrer"
          style={btn}
        >
          Buy on IONOS →
        </a>

        <a
          href="https://www.namecheap.com/domains/"
          target="_blank"
          rel="noreferrer"
          style={btn}
        >
          Buy on Namecheap →
        </a>
      </div>
    </section>
  );
}

const wrap: React.CSSProperties = {
  width: "100%",
  borderRadius: 18,
  padding: 22,
  background: "rgba(255,255,255,0.10)",
  border: "1px solid rgba(255,255,255,0.18)",
  boxShadow: "0 16px 40px rgba(0,0,0,0.18)",
  backdropFilter: "blur(10px)",
};

const title: React.CSSProperties = {
  margin: 0,
  fontSize: 26,
  fontWeight: 900,
  letterSpacing: 0.2,
  color: "rgba(255,255,255,0.95)",
};

const desc: React.CSSProperties = {
  marginTop: 10,
  marginBottom: 0,
  lineHeight: 1.45,
  fontSize: 14.5,
  color: "rgba(255,255,255,0.88)",
};

const steps: React.CSSProperties = {
  marginTop: 16,
  display: "grid",
  gap: 10,
};

const step: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.45,
  color: "rgba(255,255,255,0.88)",
};

const stepLabel: React.CSSProperties = {
  fontWeight: 900,
  marginRight: 6,
  color: "rgba(255,255,255,0.95)",
};

const btnRow: React.CSSProperties = {
  marginTop: 18,
  display: "flex",
  flexWrap: "wrap",
  gap: 12,
};

const btn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.22)",
  background: "rgba(255,255,255,0.12)",
  color: "rgba(255,255,255,0.95)",
  fontWeight: 900,
  fontSize: 13.5,
  textDecoration: "none",
  cursor: "pointer",
  transition: "transform 120ms ease, background 120ms ease",
};
