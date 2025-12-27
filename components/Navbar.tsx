"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabaseBrowser } from "@/lib/supabase-browser"

export default function Navbar() {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data } = await supabaseBrowser.auth.getSession()
      setEmail(data?.session?.user?.email ?? null)
      setLoading(false)
    }

    load()

    const { data: sub } = supabaseBrowser.auth.onAuthStateChange(() => {
      load()
    })

    return () => {
      sub?.subscription?.unsubscribe()
    }
  }, [])

  const go = (path: string) => router.push(path)

  const signOut = async () => {
    await supabaseBrowser.auth.signOut()
    router.push("/login")
  }

  return (
    <header className="w-full border-b">
      <div className="mx-auto flex max-w-6xl items-center justify-between p-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => go("/")}
            className="text-sm font-semibold"
            type="button"
          >
            Forgesite
          </button>

          <nav className="flex items-center gap-3 text-sm text-gray-700">
            <button onClick={() => go("/account")} type="button">
              Account
            </button>
            <button onClick={() => go("/settings/openai")} type="button">
              OpenAI
            </button>
            <button onClick={() => go("/billing")} type="button">
              Billing
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {loading ? (
            <span className="text-sm text-gray-500">Loading…</span>
          ) : email ? (
            <>
              <span className="text-sm text-gray-700">{email}</span>
              <button
                onClick={signOut}
                className="rounded bg-black px-3 py-2 text-sm text-white"
                type="button"
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              onClick={() => go("/login")}
              className="rounded bg-black px-3 py-2 text-sm text-white"
              type="button"
            >
              Log in
            </button>
          )}
        </div>
      </div>
    </header>
  )
}





