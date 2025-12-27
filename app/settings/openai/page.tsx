"use client"

import { useEffect, useState } from "react"
import { supabaseBrowser } from "@/lib/supabase-browser"

export default function OpenAISettingsPage() {
  const supabase = supabaseBrowser()
  const [apiKey, setApiKey] = useState("")
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    const loadKey = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const { data } = await supabase
        .from("user_settings")
        .select("openai_api_key")
        .eq("user_id", user.id)
        .single()

      if (data?.openai_api_key) {
        setApiKey(data.openai_api_key)
      }
    }

    loadKey()
  }, [])

  const saveKey = async () => {
    setStatus(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setStatus("Not authenticated")
      return
    }

    const { error } = await supabase
      .from("user_settings")
      .upsert({
        user_id: user.id,
        openai_api_key: apiKey,
      })

    if (error) {
      setStatus("Failed to save API key")
    } else {
      setStatus("API key saved")
    }
  }

  return (
    <div className="max-w-xl space-y-4 p-6">
      <h1 className="text-xl font-semibold">OpenAI API Key</h1>

      <input
        type="password"
        className="w-full rounded border px-3 py-2"
        placeholder="sk-..."
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
      />

      <button
        onClick={saveKey}
        className="rounded bg-black px-4 py-2 text-white"
      >
        Save
      </button>

      {status && <p className="text-sm">{status}</p>}
    </div>
  )
}


