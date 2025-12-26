'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase-browser'

export default function AuthCallback() {
  const router = useRouter()
  const sb = supabaseBrowser

  useEffect(() => {
    const handleSession = async () => {
      try {
        // get session info from the URL fragment after redirect
        const { data, error } = await sb.auth.getSession()
        if (error) throw error

        if (data?.session) {
          console.log('✅ Logged in as:', data.session.user.email)
          router.push('/') // redirect home (you can change this)
        } else {
          console.warn('⚠️ No session found')
          router.push('/login')
        }
      } catch (err) {
        console.error('❌ Auth callback error:', err)
        router.push('/login')
      }
    }

    handleSession()
  }, [router, sb])

  return (
    <div style={{ textAlign: 'center', marginTop: '100px' }}>
      <h2>Logging you in...</h2>
      <p>Please wait while we complete the authentication.</p>
    </div>
  )
}
