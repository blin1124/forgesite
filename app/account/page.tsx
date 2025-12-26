'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import ConnectAIKey from '@/components/ConnectAIKey';

export default function AccountPage() {
  const [supabaseClient, setSupabaseClient] = useState<any>(null);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    setSupabaseClient(supabase);

    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) =>
      setSession(session)
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  if (!supabaseClient)
    return <p className="text-center text-gray-500 mt-10">Loading Supabase client...</p>;

  return (
    <main className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Account Settings</h1>

      {!session ? (
        <Auth
          supabaseClient={supabaseClient}
          appearance={{ theme: ThemeSupa }}
          providers={['google', 'github']}
        />
      ) : (
        <ConnectAIKey user={session.user} />
      )}
    </main>
  );
}

