"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabaseBrowser } from "@/lib/supabase-browser"

export default function OpenAISettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabaseBrowser.auth.getSession()
      if (error || !data?.session) {
        router.push("/login")
        return
      }
      setEmail(data.session.user.email ?? null)
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <p className="text-sm text-gray-600">Loading…</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">OpenAI Settings</h1>
      <p className="mt-2 text-sm text-gray-600">
        Signed in as {email ?? "unknown user"}
      </p>
      <p className="mt-6 text-sm text-gray-700">
        Manage your OpenAI key on the Account page.
      </p>
    </main>
  )
}


