"use client"

import { useEffect, useState } from "react"
import { supabaseBrowser } from "@/lib/supabase-browser"

export default function ConnectAIKey() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [value, setValue] = useState("")
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setStatus(null)

      const { data, error } = await supabaseBrowser.auth.getSession()
      if (error || !data?.session?.user?.id) {
        setStatus("You must be logged in.")
        setLoading(false)
        return
      }

      // Optional: If you store keys in a table, you can load it here.
      // This component will still work without loading anything.
      setLoading(false)
    }

    load()
  }, [])

  const save = async () => {
    setSaving(true)
    setStatus(null)

    try {
      const { data, error } = await supabaseBrowser.auth.getSession()
      if (error || !data?.session?.user?.id) {
        setStatus("You must be logged in.")
        return
      }

      const apiKey = value.trim()
      if (!apiKey) {
        setStatus("Please paste an OpenAI API key.")
        return
      }

      // Call your API route that encrypts + stores the key.
      const res = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      })

      if (!res.ok) {
        const txt = await res.text()
        setStatus(txt || "Failed to save key.")
        return
      }

      setStatus("Saved.")
      setValue("")
    } catch (e: any) {
      setStatus(e?.message || "Failed to save key.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-600">Loading…</p>
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium">OpenAI API Key</label>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="sk-..."
        className="w-full rounded border px-3 py-2 text-sm"
      />
      <button
        onClick={save}
        disabled={saving}
        className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save key"}
      </button>
      {status ? <p className="text-sm text-gray-700">{status}</p> : null}
    </div>
  )
}




