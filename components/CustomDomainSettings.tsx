'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

export default function CustomDomainSettings() {
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleAddDomain = async () => {
    setLoading(true);
    setMessage('');

    if (!domain) {
      setMessage('Please enter a domain name.');
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.from('custom_domains').insert([{ domain }]);
      if (error) throw error;

      setMessage(
        '✅ Domain added successfully! Go to your DNS provider and point your CNAME to cname.forgesite.ai.'
      );
      setDomain('');
    } catch (error: any) {
      setMessage(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-12 bg-white p-6 rounded-xl shadow-md">
      <h2 className="text-2xl font-semibold mb-4 text-gray-800">
        🌍 Connect Your Custom Domain
      </h2>
      <p className="text-gray-600 mb-4">
        Add your custom domain (like <b>mybusiness.com</b>) and point your CNAME
        record to <code>cname.forgesite.ai</code>.
      </p>

      <div className="flex gap-3">
        <input
          type="text"
          placeholder="yourdomain.com"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="border rounded-lg p-2 w-full text-gray-800"
        />
        <button
          onClick={handleAddDomain}
          disabled={loading}
          className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800"
        >
          {loading ? 'Saving...' : 'Add Domain'}
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
