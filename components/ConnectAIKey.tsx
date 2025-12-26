'use client';

import { useState, useEffect } from 'react';
import supabaseBrowser from '@/lib/supabase-browser';

export default function ConnectAIKey({ user }: any) {
  const supabase = supabaseBrowser();
  const [key, setKey] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Optional: auto-load saved key if one exists
  useEffect(() => {
    const loadKey = async () => {
      if (!user?.id) return;
      const { data, error } = await supabase
        .from('user_settings')
        .select('openai_key')
        .eq('id', user.id)
        .single();
      if (data?.openai_key) {
        setMessage('✅ API key already saved.');
      }
    };
    loadKey();
  }, [user, supabase]);

  const handleSaveKey = async () => {
    if (!key.startsWith('sk-')) {
      setMessage('❌ Please enter a valid OpenAI API key (starts with sk-)');
      return;
    }

    setLoading(true);
    setMessage('');

    const { error } = await supabase
      .from('user_settings')
      .update({ openai_key: key })
      .eq('id', user?.id);

    if (error) {
      console.error(error);
      setMessage('❌ Error saving key. Please try again.');
    } else {
      setMessage('✅ OpenAI key saved successfully!');
      setKey('');
    }

    setLoading(false);
  };

  return (
    <div className="bg-white shadow-md rounded-xl p-6 mt-8">
      <h2 className="text-xl font-semibold text-gray-800 mb-3">
        🤖 Connect Your OpenAI API Key
      </h2>
      <p className="text-gray-600 mb-4">
        Enter your personal OpenAI key from{' '}
        <a
          href="https://platform.openai.com/api-keys"
          target="_blank"
          className="text-indigo-600 underline"
        >
          platform.openai.com/api-keys
        </a>. Your key stays private and will be used for your AI generations.
      </p>

      <div className="flex gap-3">
        <input
          type="password"
          placeholder="sk-..."
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className="border border-gray-300 rounded-lg p-2 w-full text-gray-800"
        />
        <button
          onClick={handleSaveKey}
          disabled={loading}
          className={`px-4 py-2 rounded-lg text-white font-semibold ${
            loading ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'
          }`}
        >
          {loading ? 'Saving...' : 'Save Key'}
        </button>
      </div>

      {message && (
        <p
          className={`mt-3 text-sm ${
            message.startsWith('✅') ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}

