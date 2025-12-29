"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabaseBrowser } from "@/lib/supabase-browser"

export default function CallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const run = async () => {
      try {
        const { data, error } = await supabaseBrowser.auth.getSession()

        if (error) {
          console.error("Callback getSession error:", error.message)
          router.push("/login")
          return
        }

        router.push(data?.session ? "/account" : "/login")
      } catch (err) {
        console.error("Callback error:", err)
        router.push("/login")
      }
    }

    run()
  }, [router])

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-xl font-semibold">Finishing sign-in…</h1>
      <p className="mt-2 text-sm text-gray-600">
        Please wait while we complete authentication.
      </p>
    </main>
  )
}



