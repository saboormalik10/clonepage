'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { clearSessionCache } from '@/lib/authenticated-fetch'
import { useEffect, useState, useMemo, type MouseEvent } from 'react'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { useIsAdmin } from '@/hooks/useIsAdmin'
import { useUserProfile } from '@/hooks/useUserProfile'

// Email that should not see user settings on navbar
const RESTRICTED_EMAIL = 'wholesale@vexiscollective.com'

export default function Header() {
  const router = useRouter()
  // Use useMemo to ensure we get the same client instance
  const supabase = useMemo(() => createClient(), [])
  const [user, setUser] = useState<any>(null)
  const isAdmin = useIsAdmin() // Use AdminContext instead of local state
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const { profile, loading: profileLoading } = useUserProfile()
  
  // Determine if user has both brand name and logo
  const hasBrand = Boolean(profile?.brand_name) && Boolean(profile?.brand_logo)
  // Use user's brand when available; otherwise show admin logo only
  const brandName: string = hasBrand ? String(profile?.brand_name) : ''
  const brandLogo: string = hasBrand ? String(profile?.brand_logo) : '/admin-logo.png'

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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event: AuthChangeEvent, session: Session | null) => {
      setUser(session?.user || null)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  const handleLogout = async (e?: MouseEvent) => {
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
    <div className="bg-gradient-to-b from-black-soft to-charcoal-900 border-b border-charcoal-700 mb-2 xl:mb-8">
      <div className="flex justify-between w-full lg:w-full lg:mx-auto xl:p-[2] 2xl:w-[1400px]">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-3 p-3 -ml-2 xl:-ml-6 hover:opacity-80 transition-opacity cursor-pointer"
          title="Go to main page"
        >
          {profileLoading ? (
            <>
              <div className="w-16 h-16 bg-charcoal-700 animate-pulse rounded ml-5 border-2 border-gold-400"></div>
              <div className="h-8 w-48 bg-charcoal-700 animate-pulse rounded"></div>
            </>
          ) : (
            <>
              <div className={`${hasBrand ? 'w-16 h-16' : 'h-16 w-32'} ml-5 border-2 border-gold-400 bg-black-rich flex items-center justify-center overflow-hidden`}>
                <img
                  src={brandLogo}
                  alt={brandName || 'Admin'}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    // Fallback to admin logo if brand logo fails to load
                    const target = e.target as HTMLImageElement
                    if (target.src !== '/admin-logo.png') {
                      target.src = '/admin-logo.png'
                    }
                  }}
                />
              </div>
              {hasBrand && (
                <span className="text-2xl font-bold text-ivory">{brandName}</span>
              )}
            </>
          )}
        </button>
        {user && (
          <div className="flex items-center gap-3 mr-2">
            {isAdmin && (
              <button
                onClick={() => router.push('/admin/dashboard')}
                className="hidden md:inline-flex items-center px-3 py-2 border border-gold-400 text-sm leading-4 font-medium text-gold-400 bg-transparent hover:bg-gold-400 hover:text-black-rich hover:shadow-[0_6px_25px_rgba(212,175,55,0.7)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gold-400 transition-all duration-300"
                title="Switch to Admin Panel"
              >
                <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Admin Panel
              </button>
            )}
            {!isAdmin && (user?.email?.toLowerCase() !== RESTRICTED_EMAIL.toLowerCase() && profile?.email?.toLowerCase() !== RESTRICTED_EMAIL.toLowerCase()) && (
              <button
                onClick={() => router.push('/settings')}
                className="inline-flex items-center px-3 py-2 border border-charcoal-600 text-sm leading-4 font-medium text-champagne bg-charcoal-800 hover:border-gold-400 hover:text-gold-400 hover:shadow-[0_6px_25px_rgba(212,175,55,0.7)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gold-400 transition-all duration-300"
                title="Settings"
              >
                <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Settings
              </button>
            )}
            <button 
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="text-sm font-body text-gold-400 ml-2 uppercase tracking-wider hover:text-gold-300 disabled:opacity-50 disabled:cursor-not-allowed border border-gold-400 px-3 py-1.5 hover:bg-gold-400 hover:text-black-rich hover:shadow-[0_6px_25px_rgba(212,175,55,0.7)] transition-all duration-300"
            >
              {isLoggingOut ? 'Logging out...' : 'Log out'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

