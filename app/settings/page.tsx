'use client';
import { useState } from 'react';
import supabaseBrowser from '@/lib/supabase-browser';

export default function SettingsPage({ user }: any) {
  const supabase = supabaseBrowser();
  const [key, setKey] = useState('');
  const [message, setMessage] = useState('');

  const saveKey = async () => {
    const { error } = await supabase
      .from('user_settings')
      .upsert({ user_id: user.id, openai_api_key: key });

    if (error) setMessage('❌ Error saving key');
    else setMessage('✅ API key saved successfully!');
  };

  return (
    <main className="max-w-xl mx-auto mt-16 bg-white p-8 rounded-xl shadow">
      <h1 className="text-2xl font-bold mb-4">🔑 Connect Your OpenAI API Key</h1>
      <p className="text-gray-600 mb-4">
        Your key is stored securely and used only for your generations.
      </p>
      <input
        type="password"
        placeholder="sk-proj-..."
        value={key}
        onChange={(e) => setKey(e.target.value)}
        className="border p-2 w-full rounded mb-4"
      />
      <button
        onClick={saveKey}
        className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
      >
        Save Key
      </button>
      {message && <p className="mt-3 text-sm">{message}</p>}
    </main>
  );
}
