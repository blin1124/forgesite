"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabaseBrowser } from "@/lib/supabase-browser"

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    const check = async () => {
      const { data } = await supabaseBrowser.auth.getSession()
      if (data?.session) router.push("/account")
    }
    check()
  }, [router])

  const signInWithGoogle = async () => {
    setErrorMsg(null)
    setLoading(true)
    try {
      const origin =
        typeof window !== "undefined" ? window.location.origin : ""
      const redirectTo = `${origin}/auth/callback`

      const { error } = await supabaseBrowser.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      })

      if (error) setErrorMsg(error.message)
    } catch (e: any) {
      setErrorMsg(e?.message || "Login failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold">Log in</h1>
      <p className="mt-2 text-sm text-gray-600">
        Sign in to manage your Forgesite account.
      </p>

      {errorMsg ? (
        <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorMsg}
        </p>
      ) : null}

      <button
        onClick={signInWithGoogle}
        disabled={loading}
        className="mt-6 w-full rounded bg-black px-4 py-2 text-white disabled:opacity-60"
      >
        {loading ? "Starting…" : "Continue with Google"}
      </button>
    </main>
  )
}



