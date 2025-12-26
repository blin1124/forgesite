'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase-browser'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const handleAuth = async () => {
      const { data, error } = await supabaseBrowser.auth.getSession()
      if (error) {
        console.error('Error fetching session:', error.message)
        router.push('/login')
        return
      }

      if (data?.session) {
        console.log('User session:', data.session)
        router.push('/builder') // 👈 redirect to main page after login
      } else {
        router.push('/login')
      }
    }

    handleAuth()
  }, [router])

  return (
    <div className="flex items-center justify-center h-screen">
      <h2 className="text-lg font-semibold text-gray-700">Signing you in...</h2>
    </div>
  )
}
