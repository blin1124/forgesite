import { redirect } from "next/navigation";

export default function BillingSuccess({
  searchParams,
}: {
  searchParams: { next?: string; session_id?: string };
}) {
  // next defaults to builder
  const next = searchParams?.next || "/builder";

  // session_id is passed by Stripe, we don't need it here unless you're validating
  // Keeping it in params prevents confusion, but we still just redirect.
  redirect(next);
}

