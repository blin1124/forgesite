import Link from "next/link"

export default function SettingsHomePage() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="mt-2 text-sm text-gray-600">
        Manage integrations and account settings.
      </p>

      <div className="mt-6 grid gap-4">
        <Link href="/billing" className="rounded border p-4 hover:bg-gray-50">
          <div className="text-sm font-medium">Billing</div>
          <div className="mt-1 text-sm text-gray-600">
            Subscribe and manage your plan.
          </div>
        </Link>

        <Link href="/settings/openai" className="rounded border p-4 hover:bg-gray-50">
          <div className="text-sm font-medium">OpenAI Key</div>
          <div className="mt-1 text-sm text-gray-600">
            Optional — only needed for AI generation features.
          </div>
        </Link>

        <Link href="/account" className="rounded border p-4 hover:bg-gray-50">
          <div className="text-sm font-medium">Account</div>
          <div className="mt-1 text-sm text-gray-600">
            View your account details.
          </div>
        </Link>
      </div>
    </main>
  )
}
