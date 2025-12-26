"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";

export default function Navbar() {
  const [hydrated, setHydrated] = useState(false);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  // Prevent hydration mismatch
  useEffect(() => {
    setHydrated(true);
  }, []);

  // Load user ONLY after hydration
  useEffect(() => {
    if (!hydrated) return;

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user || null);
    });
  }, [hydrated]);

  // ⛔️ On server, render nothing → eliminates mismatch
  if (!hydrated) return null;

  return (
    <nav
      style={{
        width: "100%",
        padding: "1rem 2rem",
        background: "rgba(255, 255, 255, 0.15)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255,255,255,0.25)",
        color: "white",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        position: "sticky",
        top: 0,
        zIndex: 999,
      }}
    >
      {/* LOGO */}
      <div
        style={{ fontSize: "1.6rem", fontWeight: "800", cursor: "pointer" }}
        onClick={() => router.push("/")}
      >
        ForgeSite
      </div>

      {/* BUTTONS */}
      <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
        {!user && (
          <>
            <button onClick={() => router.push("/login")} style={buttonStyle}>
              Login
            </button>

            <button
              onClick={() => router.push("/signup")}
              style={{ ...buttonStyle, background: "white", color: "#6a5af9" }}
            >
              Sign Up
            </button>
          </>
        )}

        {user && (
          <>
            <span style={{ opacity: 0.8 }}>{user.email}</span>

            <button
              onClick={() => router.push("/builder")}
              style={{ ...buttonStyle, background: "white", color: "#6a5af9" }}
            >
              Builder
            </button>

            <button
              onClick={async () => {
                await supabase.auth.signOut();
                router.push("/login");
              }}
              style={{
                ...buttonStyle,
                background: "rgba(255,50,50,0.9)",
                border: "1px solid rgba(255,255,255,0.4)",
              }}
            >
              Logout
            </button>
          </>
        )}
      </div>
    </nav>
  );
}

const buttonStyle: React.CSSProperties = {
  padding: "0.5rem 1.2rem",
  borderRadius: "10px",
  background: "rgba(255,255,255,0.25)",
  color: "white",
  border: "1px solid rgba(255,255,255,0.4)",
  cursor: "pointer",
  fontWeight: 600,
};





