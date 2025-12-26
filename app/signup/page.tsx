"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();

  // All hooks MUST run before any conditional return
  const [hydrated, setHydrated] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    setHydrated(true);
  }, []);

  // Safe place for early return
  if (!hydrated) return null;

  const handleSignup = async () => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Account created! Check your email.");
    router.push("/login");
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
        <h2 style={{ marginBottom: "1.5rem" }}>Create Account</h2>

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
          onClick={handleSignup}
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
          Sign Up
        </button>

        <p style={{ marginTop: "1rem" }}>
          Already have an account?{" "}
          <span
            onClick={() => router.push("/login")}
            style={{ textDecoration: "underline", cursor: "pointer" }}
          >
            Log In
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


