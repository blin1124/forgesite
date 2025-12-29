"use client";

import { useEffect } from "react";

export default function ClientEffects() {
  useEffect(() => {
    // Put ALL browser-only DOM mutations in here.
    // Example: theme class, analytics, etc.

    // Example theme (optional):
    // const theme = localStorage.getItem("theme");
    // if (theme === "dark") document.documentElement.classList.add("dark");
  }, []);

  // ✅ IMPORTANT: render nothing so server/client markup matches
  return null;
}

