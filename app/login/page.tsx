"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  // Must be first (all hooks run before conditional)
  const [hydrated, setHydrated] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    setHydrated(true);
  }, []);

  // Prevent hydration mismatch
  if (!hydrated) return null;

  const handleLogin = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Login successful!");
    router.push("/builder");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg,#6a5af9,#9d58ff,#c057f7)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "2rem",
      }}
    >
      <div
        style={{
          width: "380px",
          padding: "2rem",
          background: "rgba(255,255,255,0.18)",
          borderRadius: "16px",
          backdropFilter: "blur(14px)",
          border: "1px solid rgba(255,255,255,0.25)",
          color: "white",
          textAlign: "center",
        }}
      >
        <h2 style={{ marginBottom: "1.5rem" }}>Log In</h2>

        <label style={{ display: "block", textAlign: "left", marginBottom: "0.5rem" }}>
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />

        <label style={{ display: "block", textAlign: "left", marginTop: "1rem" }}>
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />

        <button
          onClick={handleLogin}
          style={{
            marginTop: "1.4rem",
            width: "100%",
            padding: "0.8rem",
            borderRadius: "10px",
            border: "none",
            fontWeight: "700",
            fontSize: "1.1rem",
            cursor: "pointer",
            background: "white",
            color: "#6a5af9",
          }}
        >
          Log In
        </button>

        <p style={{ marginTop: "1rem" }}>
          Don’t have an account?{" "}
          <span
            onClick={() => router.push("/signup")}
            style={{ textDecoration: "underline", cursor: "pointer" }}
          >
            Sign Up
          </span>
        </p>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.8rem",
  borderRadius: "10px",
  border: "2px solid rgba(255,255,255,0.35)",
  background: "rgba(255,255,255,0.25)",
  color: "white",
  fontSize: "1rem",
  outline: "none",
};



