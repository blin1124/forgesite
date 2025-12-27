export const dynamic = "force-dynamic"

import { Suspense } from "react"
import BillingClient from "./BillingClient"

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-600">Loading billing…</div>}>
      <BillingClient />
    </Suspense>
  )
}



