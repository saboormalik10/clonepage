'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { useEffect, useState, useMemo } from 'react'

export default function Header() {
  const router = useRouter()
  // Use useMemo to ensure we get the same client instance
  const supabase = useMemo(() => createClient(), [])
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    // Check if user is logged in and if they are admin
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user || null)
      
      // Check if user is admin
      if (session?.user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', session.user.id)
          .single()
        
        setIsAdmin(profile?.role === 'admin')
      } else {
        setIsAdmin(false)
      }
    }

    checkUser()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user || null)
      
      if (session?.user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', session.user.id)
          .single()
        
        setIsAdmin(profile?.role === 'admin')
      } else {
        setIsAdmin(false)
      }
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
          <div className="flex items-center gap-3 mr-2">
            {isAdmin && (
              <button
                onClick={() => router.push('/admin/dashboard')}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                title="Switch to Admin Panel"
              >
                <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Admin Panel
              </button>
            )}
            <button 
              onClick={handleLogout}
              className="text-sm font-body text-primary ml-2 uppercase hover:opacity-50"
            >
              Log out
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

