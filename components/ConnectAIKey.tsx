"use client"

import { useState } from "react"
import { supabaseBrowser } from "@/lib/supabase-browser"

export default function ConnectAIKey() {
  const [apiKey, setApiKey] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const handleSave = async () => {
    setLoading(true)
    setMessage(null)

    const supabase = supabaseBrowser()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setMessage("Not authenticated")
      setLoading(false)
      return
    }

    const { error } = await supabase
      .from("user_settings")
      .upsert({
        user_id: user.id,
        openai_api_key: apiKey,
      })

    if (error) {
      setMessage("Failed to save API key")
    } else {
      setMessage("API key saved successfully")
      setApiKey("")
    }

    setLoading(false)
  }

  return (
    <div className="space-y-3">
      <input
        type="password"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder="Enter your OpenAI API key"
        className="w-full rounded border px-3 py-2"
      />

      <button
        onClick={handleSave}
        disabled={loading || !apiKey}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {loading ? "Saving..." : "Save API Key"}
      </button>

      {message && <p className="text-sm">{message}</p>}
    </div>
  )
}


