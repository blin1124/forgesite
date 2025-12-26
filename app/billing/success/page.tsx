import { redirect } from "next/navigation";

export default function BillingSuccess({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const next = searchParams?.next || "/builder";
  redirect(next);
}
