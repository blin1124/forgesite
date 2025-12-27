"use client"

import { useState } from "react"
import { supabaseBrowser } from "@/lib/supabase-browser"
import { useRouter } from "next/navigation"

export default function SignupPage() {
  const router = useRouter()
  const supabase = supabaseBrowser()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSignup = async () => {
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push("/login")
  }

  return (
    <div className="mx-auto max-w-md space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Sign up</h1>

      <input
        type="email"
        placeholder="Email"
        className="w-full rounded border px-3 py-2"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        type="password"
        placeholder="Password"
        className="w-full rounded border px-3 py-2"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={handleSignup}
        disabled={loading}
        className="w-full rounded bg-black py-2 text-white disabled:opacity-50"
      >
        {loading ? "Creating account..." : "Create account"}
      </button>
    </div>
  )
}


