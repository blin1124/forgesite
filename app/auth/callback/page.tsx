"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabaseBrowser } from "@/lib/supabase-browser"

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const run = async () => {
      try {
        const { error } = await supabaseBrowser.auth.getSession()

        if (error) {
          console.error("Error fetching session:", error.message)
          router.push("/login")
          return
        }

        router.push("/account")
      } catch (err) {
        console.error("Auth callback error:", err)
        router.push("/login")
      }
    }

    run()
  }, [router])

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-xl font-semibold">Signing you in…</h1>
      <p className="mt-2 text-sm text-gray-600">
        Please wait while we complete authentication.
      </p>
    </main>
  )
}



