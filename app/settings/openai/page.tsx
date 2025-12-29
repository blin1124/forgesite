import Link from "next/link"

export default function OpenAISettingsPage() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">OpenAI Settings</h1>
      <p className="mt-2 text-sm text-gray-600">
        This is optional. You can build and manage sites without an OpenAI key.
      </p>

      <div className="mt-6 rounded border p-4">
        <p className="text-sm text-gray-700">
          To add or update your OpenAI key, go to your Account page.
        </p>

        <div className="mt-4 flex gap-3">
          <Link className="rounded bg-black px-4 py-2 text-sm text-white" href="/account">
            Go to Account
          </Link>
          <Link className="rounded border px-4 py-2 text-sm" href="/builder">
            Back to Builder
          </Link>
        </div>
      </div>
    </main>
  )
}


