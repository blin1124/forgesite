"use client";

import React from "react";

type Props = {
  /** Optional: if you have an in-app domain connect flow, pass a handler */
  onConnectClick?: () => void;
};

export default function CustomDomainCard({ onConnectClick }: Props) {
  return (
    <section style={wrap}>
      <h2 style={title}>Custom domain (what customers expect)</h2>

      <p style={subtitle}>
        When you finish designing your site, you can connect your own domain (like{" "}
        <b>yourbusiness.com</b>). You’ll buy the domain from a registrar, then connect it inside ForgeSite.
      </p>

      <div style={steps}>
        <div style={step}>
          <b>Step 1:</b> Buy a domain from GoDaddy, IONOS, Namecheap, etc.
        </div>
        <div style={step}>
          <b>Step 2:</b> In ForgeSite, you’ll enter the domain and we’ll show you the DNS records to add.
        </div>
        <div style={step}>
          <b>Step 3:</b> DNS can take a little while to update (often minutes, sometimes longer).
        </div>
      </div>

      <div style={btnRow}>
        <a
          href="https://www.godaddy.com/domains"
          target="_blank"
          rel="noreferrer noopener"
          style={btn}
        >
          Buy on GoDaddy →
        </a>

        <a
          href="https://www.ionos.com/domains"
          target="_blank"
          rel="noreferrer noopener"
          style={btn}
        >
          Buy on IONOS →
        </a>

        <a
          href="https://www.namecheap.com/domains/"
          target="_blank"
          rel="noreferrer noopener"
          style={btn}
        >
          Buy on Namecheap →
        </a>

        {onConnectClick ? (
          <button type="button" onClick={onConnectClick} style={btnPrimary}>
            Connect inside ForgeSite →
          </button>
        ) : null}
      </div>
    </section>
  );
}

const wrap: React.CSSProperties = {
  background: "rgba(255,255,255,0.12)",
  border: "1px solid rgba(255,255,255,0.18)",
  borderRadius: 18,
  padding: 18,
  boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
};

const title: React.CSSProperties = {
  margin: 0,
  fontSize: 22,
  fontWeight: 900,
  letterSpacing: 0.2,
};

const subtitle: React.CSSProperties = {
  marginTop: 10,
  marginBottom: 12,
  opacity: 0.92,
  lineHeight: 1.35,
};

const steps: React.CSSProperties = {
  display: "grid",
  gap: 8,
  marginBottom: 14,
};

const step: React.CSSProperties = {
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 14,
  padding: "10px 12px",
  lineHeight: 1.25,
};

const btnRow: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
};

const btn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.22)",
  background: "rgba(255,255,255,0.10)",
  color: "white",
  fontWeight: 900,
  textDecoration: "none",
  cursor: "pointer",
};

const btnPrimary: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.92)",
  color: "rgb(85, 40, 150)",
  fontWeight: 900,
  cursor: "pointer",
};
