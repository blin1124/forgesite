"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"

export default function BillingClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    const success = searchParams.get("success")
    const canceled = searchParams.get("canceled")

    if (success) setStatus("✅ Payment successful! Your subscription is active.")
    else if (canceled) setStatus("Payment canceled.")
    else setStatus(null)
  }, [searchParams])

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Billing</h1>

      {status ? (
        <div className="mt-4 rounded border p-3 text-sm">{status}</div>
      ) : (
        <p className="mt-2 text-sm text-gray-600">
          Manage your subscription and seats.
        </p>
      )}

      <div className="mt-6 flex gap-3">
        <button
          className="rounded bg-black px-4 py-2 text-sm text-white"
          type="button"
          onClick={() => router.push("/api/checkout")}
        >
          Subscribe / Manage
        </button>

        <button
          className="rounded border px-4 py-2 text-sm"
          type="button"
          onClick={() => router.push("/account")}
        >
          Back to Account
        </button>
      </div>
    </main>
  )
}
