import ConnectAIKey from "@/components/ConnectAIKey"

export default function AccountPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Account</h1>
        <p className="text-sm text-gray-600">
          Manage your API keys and settings.
        </p>
      </div>

      <section className="rounded border p-4">
        <h2 className="mb-2 text-lg font-semibold">Connect your OpenAI key</h2>
        <p className="mb-4 text-sm text-gray-600">
          Save your OpenAI API key so Forgesite can generate and manage website projects.
        </p>

        {/* ✅ FIX: no user prop */}
        <ConnectAIKey />
      </section>
    </main>
  )
}


