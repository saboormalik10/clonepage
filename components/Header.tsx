'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { useEffect, useState, useMemo } from 'react'

export default function Header() {
  const router = useRouter()
  // Use useMemo to ensure we get the same client instance
  const supabase = useMemo(() => createClient(), [])
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    // Check if user is logged in
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user || null)
    }

    checkUser()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  const handleLogout = async () => {
    try {
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        console.error('Error logging out:', error)
        // Still redirect even if there's an error
      }
      
      // Clear local user state
      setUser(null)
      
      // Redirect to login page
      router.push('/login')
      router.refresh() // Force a refresh to clear any cached data
    } catch (error) {
      console.error('Error logging out:', error)
      // Still redirect on error
      router.push('/login')
    }
  }

  return (
    <div className="bg-white mb-2 xl:mb-8">
      <div className="flex justify-between w-full lg:w-full lg:mx-auto xl:p-[2] 2xl:w-[1400px]">
        <div className="flex items-center gap-3 p-3 -ml-2 xl:-ml-6">
          <img
            src="/logo.png"
            alt="Logo"
            className="w-16 h-16 object-contain ml-5"
          />
          <span className="text-2xl font-bold text-gray-800">Hotshot Social</span>
        </div>
        {user && (
          <button 
            onClick={handleLogout}
            className="text-sm font-body text-primary ml-2 uppercase hover:opacity-50 mr-2"
          >
            Log out
          </button>
        )}
      </div>
    </div>
  )
}

