// app/builder/page.tsx
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";

export default async function BuilderPage() {
  const supabase = supabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not logged in -> go login
  if (!user) {
    redirect("/login?next=%2Fbuilder");
  }

  /**
   * IMPORTANT:
   * If your "must subscribe first" rule is enforced in middleware / billing logic,
   * keep that there. This page just ensures user is logged in.
   *
   * If you ALSO want to force billing here, uncomment this:
   *
   * redirect("/billing");
   */

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800 }}>Builder</h1>
      <p style={{ marginTop: 8, opacity: 0.8 }}>
        Your builder UI should render here (keep your existing components below if you have them).
      </p>

      {/* TODO: put your existing builder component back here if you have one */}
      {/* Example: <BuilderClient /> */}
    </main>
  );
}

















