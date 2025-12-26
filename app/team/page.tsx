'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Member = {
  id: string
  email: string
  role: string
  created_at: string
}

export default function Team() {
  const [members, setMembers] = useState<Member[]>([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('member')

  useEffect(() => {
    loadMembers()
  }, [])

  const loadMembers = async () => {
    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) console.error('Error fetching members:', error)
    else setMembers(data || [])
  }

  const addMember = async () => {
    if (!email) return
    const { error } = await supabase
      .from('team_members')
      .insert([{ email, role }])
    if (!error) {
      setEmail('')
      loadMembers()
    }
  }

  const roleColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-yellow-500 text-white'
      case 'member': return 'bg-blue-500 text-white'
      default: return 'bg-gray-400 text-white'
    }
  }

  return (
    <div className="min-h-screen bg-[#f9fafb] px-8 py-10">
      <h1 className="text-3xl font-bold mb-6 text-[#111827]">Team Members</h1>

      <div className="space-y-4">
        {members.length === 0 ? (
          <p className="text-gray-500">No team members found.</p>
        ) : (
          members.map((m) => (
            <div
              key={m.id}
              className="p-4 bg-white shadow-sm rounded-lg border border-gray-200 flex items-center justify-between"
            >
              <div>
                <p className="text-lg font-semibold">{m.email}</p>
                <span
                  className={`inline-block mt-1 px-3 py-1 rounded-full text-sm font-medium ${roleColor(
                    m.role
                  )}`}
                >
                  {m.role}
                </span>
              </div>
              <p className="text-gray-400 text-sm">
                {new Date(m.created_at).toLocaleDateString()}
              </p>
            </div>
          ))
        )}
      </div>

      <hr className="my-8" />
      <div className="flex items-center gap-3">
        <input
          type="email"
          placeholder="email@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border border-gray-300 px-3 py-2 rounded-md w-64"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="border border-gray-300 px-3 py-2 rounded-md"
        >
          <option value="member">Member</option>
          <option value="owner">Owner</option>
        </select>
        <button
          onClick={addMember}
          className="bg-[#111827] text-white px-4 py-2 rounded-md hover:bg-[#1f2937]"
        >
          Add
        </button>
      </div>
    </div>
  )
}


