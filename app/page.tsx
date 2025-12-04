'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import PricingTabs from '@/components/PricingTabs'
import BroadcastMessagePopup from '@/components/BroadcastMessagePopup'
import { createClient } from '@/lib/supabase-client'
import { refreshSession, hasValidSession, getSessionWithTimeout } from '@/lib/session-refresh'
import { useUserProfile } from '@/hooks/useUserProfile'

export default function Home() {
  const router = useRouter()
  // Use useMemo to ensure we get the same client instance
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const { profile, loading: profileLoading } = useUserProfile()
  
  // Get brand name from profile, fallback to default
  // Only use default if profile is loaded and doesn't have brand info
  const brandName = profile?.brand_name || 'Hotshot Social'

  useEffect(() => {
    const checkAuth = async () => {
      try {
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
        let session = storageSession

        // If we got session from localStorage, set it in Supabase client
        if (session) {
          try {
            // Set session with timeout to prevent blocking
            await Promise.race([
              supabase.auth.setSession({
                access_token: session.access_token,
                refresh_token: session.refresh_token
              }),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('setSession timeout')), 2000)
              )
            ])
          } catch (setSessionError: any) {
            // If setting session fails or times out, continue with the session we have
            // The Supabase client should still work with localStorage
            if (!setSessionError?.message?.includes('timeout')) {
              console.warn('Failed to set session in Supabase client:', setSessionError)
            }
          }
        }

        // If no localStorage session, fallback to session API with timeout
        if (!session) {
          const { data: { session: apiSession }, error } = await getSessionWithTimeout(supabase, 3000)
          if (error && !error.message?.includes('timeout')) {
            console.error('Auth check error:', error)
            router.push('/login')
            return
          }
          session = apiSession
        }
        
        if (!session) {
          router.push('/login')
          return
        }

        setUser(session.user)

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
          if (!session) {
            // Before redirecting, check if we have a valid session in localStorage
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

            const storageSession = getSessionFromStorage()
            if (storageSession) {
              // We have a valid localStorage session, don't redirect
              console.log('✅ [Page] Auth state changed but localStorage session is valid')
              setUser(storageSession.user)
            } else {
              // No valid localStorage session, redirect to login
              console.log('⚠️ [Page] No valid session found, redirecting to login')
              router.push('/login')
            }
          } else {
            setUser(session.user)
          }
        })

        setLoading(false)

        return () => subscription.unsubscribe()
      } catch (error) {
        console.error('Auth check error:', error)
        router.push('/login')
      }
    }

    checkAuth()
  }, [router, supabase])

  // Handle visibility change - check localStorage first, no redirects on timeout
  useEffect(() => {
    const handleVisibilityChange = async () => {
      // Only check when tab becomes visible (not when it becomes hidden)
      if (document.visibilityState === 'visible') {
        console.log('👁️ [Page] Tab became visible, checking session...')
        
        // First check localStorage (instant, no timeout)
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

        const storageSession = getSessionFromStorage()
        if (storageSession) {
          console.log('✅ [Page] Valid session found in localStorage')
          // Update user state if needed
          if (!user || user.id !== storageSession.user?.id) {
            setUser(storageSession.user)
          }
          return
        }

        // Only if no localStorage session, try API (but don't redirect on timeout)
        try {
          const { data: { session }, error } = await getSessionWithTimeout(supabase, 3000)
          if (session?.access_token) {
            console.log('✅ [Page] Valid session found via API')
            setUser(session.user)
          } else if (!error?.message?.includes('timeout')) {
            // Only redirect if there's a real error (not timeout)
            console.warn('⚠️ [Page] No valid session found, redirecting to login')
            router.push('/login')
          }
        } catch (error) {
          // Don't redirect on errors - user might still have valid localStorage session
          console.log('⚠️ [Page] Session check failed, but continuing (localStorage might be valid)')
        }
      }
    }

    // Listen for visibility changes only (focus events are too aggressive)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [router, supabase]) // Removed 'user' dependency as it's not used in the effect

  // Show loading if auth is loading OR profile is loading
  if (loading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (!user) {
    return null // Will redirect to login
  }

  return (
    <div className="__variable_a59c88">
      <div 
        style={{
          position: 'fixed',
          zIndex: 9999,
          top: '16px',
          left: '16px',
          right: '16px',
          bottom: '16px',
          pointerEvents: 'none'
        }}
      />
      <Header />
      <main className="w-full p-2 lg:w-full lg:p-4 lg:mx-auto xl:p-[2] 2xl:w-[1650px]">
        <section className="mt-2 mb-4 flex-col font-body space-y-3 flex lg:space-y-0 lg:items-center lg:flex-row justify-between">
          <div className="flex flex-col">
            <h1 className="text-2xl uppercase bold">Pricing ({brandName})</h1>
            <p className="text-sm">
              Once we have published the article for you, any further edits may include an extra charge.
            </p>
            <p className="text-sm">
              We will use reasonable good faith efforts to ensure that such article will remain publicly available in the applicable publication for at least 12 months.
            </p>
          </div>
          <div className="flex space-x-2">
            {/* <a
              href="https://www.loom.com/share/ee69b887e5574fad9b5342c4d9c80f15?sid=3328344c-b5d4-4a50-85d1-eba58c2f816d"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-primary p-2 px-2 text-white font-body text-sm"
            >
              Video Tutorial
            </a> */}
            {/* <a
              href="https://www.figma.com/proto/0VHlTHQ0nY19KcyvrSwcCG/Hotshot Social-Pricing-Portal?type=design&node-id=1-2&t=4SMS3QL3VksDvURV-0&scaling=contain&page-id=0%3A1"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-primary p-2 px-2 text-white font-body text-sm"
            >
              How To
            </a> */}
            <a
              href="https://docs.google.com/document/d/1fMHASfp2its2jacTJyxN2LYiG6ABhNKup0WGsaOrlHk/edit?usp=sharing"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-primary p-2 px-2 text-white font-body text-sm"
            >
              Download PR Questionnaire
            </a>
            {/* <a
              href="https://docs.google.com/document/d/19et1cFZnL6DS8tX6P95c41wbJwYdAHvdHhqzGkBxIeY/edit?usp=sharing"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-primary p-2 px-2 text-white font-body text-sm"
            >
              Download TV Questionnaire
            </a> */}
          </div>
        </section>
        <PricingTabs />
      </main>
      <BroadcastMessagePopup />
    </div>
  )
}

