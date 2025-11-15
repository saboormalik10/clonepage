'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { clearSessionCache } from '@/lib/authenticated-fetch'
import { useEffect, useState, useMemo } from 'react'
import { useIsAdmin } from '@/hooks/useIsAdmin'

export default function Header() {
  const router = useRouter()
  // Use useMemo to ensure we get the same client instance
  const supabase = useMemo(() => createClient(), [])
  const [user, setUser] = useState<any>(null)
  const isAdmin = useIsAdmin() // Use AdminContext instead of local state
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  useEffect(() => {
    // Check if user is logged in - try localStorage first, then API
    const checkUser = async () => {
      // First try localStorage (instant, synchronous)
      const getSessionFromStorage = (): any => {
        try {
          // @ts-ignore - process.env is available in Next.js client components
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
          let projectRef = 'default'
          try {
            const urlMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)
            if (urlMatch && urlMatch[1]) {
              projectRef = urlMatch[1]
            } else {
              const parts = supabaseUrl.split('//')
              if (parts[1]) {
                projectRef = parts[1].split('.')[0]
              }
            }
          } catch (e) {
            // Use default if extraction fails
          }
          const storageKey = `sb-${projectRef}-auth-token`
          
          const stored = localStorage.getItem(storageKey)
          if (stored) {
            const parsed = JSON.parse(stored)
            if (parsed?.access_token && parsed?.expires_at) {
              const expiresAt = parsed.expires_at * 1000
              if (expiresAt > Date.now()) {
                return {
                  access_token: parsed.access_token,
                  refresh_token: parsed.refresh_token,
                  expires_at: parsed.expires_at,
                  user: parsed.user
                }
              }
            }
          }
        } catch (error) {
          // Ignore storage errors
        }
        return null
      }

      // Try localStorage first
      const storageSession = getSessionFromStorage()
      if (storageSession) {
        setUser(storageSession.user || null)
        return
      }

      // Fallback to API with timeout
      try {
        const { data: { session } } = await Promise.race([
          supabase.auth.getSession(),
          new Promise<{ data: { session: null } }>((_, reject) => 
            setTimeout(() => reject(new Error('Session timeout')), 3000)
          )
        ])
        setUser(session?.user || null)
      } catch (error) {
        // On timeout or error, user stays null
        setUser(null)
      }
    }

    checkUser()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user || null)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  const handleLogout = async (e?: React.MouseEvent) => {
    // Prevent double-clicks and event bubbling
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    
    // Prevent multiple simultaneous logout attempts
    if (isLoggingOut) {
      return
    }
    
    setIsLoggingOut(true)
    
    // Clear session cache immediately
    clearSessionCache()
    
    // Clear localStorage manually (in case signOut hangs)
    try {
        // @ts-ignore - process.env is available in Next.js client components
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
      let projectRef = 'default'
      try {
        const urlMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)
        if (urlMatch && urlMatch[1]) {
          projectRef = urlMatch[1]
        } else {
          const parts = supabaseUrl.split('//')
          if (parts[1]) {
            projectRef = parts[1].split('.')[0]
          }
        }
      } catch (e) {
        // Use default
      }
      const storageKey = `sb-${projectRef}-auth-token`
      localStorage.removeItem(storageKey)
    } catch (storageError) {
      // Ignore storage errors
    }
    
    // Clear local user state immediately
    setUser(null)
    
    // Redirect to login page IMMEDIATELY (don't wait for signOut)
    window.location.href = '/login'
    
    // Sign out from Supabase in background (don't wait for it)
    supabase.auth.signOut().catch(() => {
      // Ignore errors - we're already logged out locally
    })
  }

  return (
    <div className="bg-white mb-2 xl:mb-8">
      <div className="flex justify-between w-full lg:w-full lg:mx-auto xl:p-[2] 2xl:w-[1400px]">
        <div className="flex items-center gap-3 p-3 -ml-2 xl:-ml-6">
          <img
            src="/logo.jpeg"
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
              disabled={isLoggingOut}
              className="text-sm font-body text-primary ml-2 uppercase hover:opacity-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoggingOut ? 'Logging out...' : 'Log out'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

