import { redirect } from "next/navigation";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export default async function BuilderPage() {
  const supabase = createServerComponentClient({ cookies });
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/login?next=%2Fbuilder");
  }

  // If you have a BuilderClient component already, put it back here.
  return (
    <div style={{ padding: 18 }}>
      <h1>Builder</h1>
      <p>Signed in as {data.user.email}</p>
      <p>If your real builder UI existed before, paste it back inside this page.</p>
    </div>
  );
}

























