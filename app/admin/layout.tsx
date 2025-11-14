'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { refreshSession, hasValidSession } from '@/lib/session-refresh'
import { clearSessionCache } from '@/lib/authenticated-fetch'
import Link from 'next/link'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [viewMode, setViewMode] = useState<'admin' | 'portal'>('admin')
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const supabase = createClient()
  
  // Check if we're on admin routes or main portal
  useEffect(() => {
    if (pathname?.startsWith('/admin')) {
      setViewMode('admin')
    } else {
      setViewMode('portal')
    }
  }, [pathname])

  useEffect(() => {
    // Skip auth check for login page (redirects to /login anyway)
    if (pathname === '/admin/login') {
      setLoading(false)
      return
    }

    let mounted = true

    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!mounted) return

        if (!session) {
          router.push('/login')
          return
        }

        // Check if user is admin - only select role field for better performance
        const { data: profile, error } = await supabase
          .from('user_profiles')
          .select('id, email, role')
          .eq('id', session.user.id)
          .single()

        if (!mounted) return

        if (error || !profile || profile.role !== 'admin') {
          router.push('/login')
          return
        }

        setUser(profile)
      } catch (error) {
        console.error('Auth check error:', error)
        if (mounted) {
          router.push('/login')
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    checkAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      if (!session && pathname !== '/admin/login') {
        router.push('/login')
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, router])

  // Handle visibility change - refresh session when tab becomes visible again
  useEffect(() => {
    // Skip for login page
    if (pathname === '/admin/login') {
      return
    }

    const handleVisibilityChange = async () => {
      // Only refresh when tab becomes visible (not when it becomes hidden)
      if (document.visibilityState === 'visible') {
        console.log('👁️ [AdminLayout] Tab became visible, checking session...')
        
        // Check if we have a valid session
        const hasSession = await hasValidSession()
        
        if (!hasSession) {
          console.warn('⚠️ [AdminLayout] No valid session when tab became visible, redirecting to login')
          router.push('/login')
          return
        }
        
        // Refresh session to ensure it's up to date
        const refreshed = await refreshSession()
        
        if (!refreshed) {
          console.warn('⚠️ [AdminLayout] Failed to refresh session when tab became visible')
          // Don't redirect immediately - let the auth state change handler deal with it
        } else {
          console.log('✅ [AdminLayout] Session refreshed after tab became visible')
        }
      }
    }

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // Also listen for focus events as a backup
    const handleFocus = async () => {
      console.log('👁️ [AdminLayout] Window focused, checking session...')
      const hasSession = await hasValidSession()
      
      if (!hasSession) {
        console.warn('⚠️ [AdminLayout] No valid session when window focused, redirecting to login')
        router.push('/login')
        return
      }
      
      await refreshSession()
    }
    
    window.addEventListener('focus', handleFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [pathname, router])

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
    
    // Redirect to login page IMMEDIATELY (don't wait for signOut)
    window.location.href = '/login'
    
    // Sign out from Supabase in background (don't wait for it)
    supabase.auth.signOut().catch(() => {
      // Ignore errors - we're already logged out locally
    })
  }

  const handleViewToggle = (mode: 'admin' | 'portal') => {
    setViewMode(mode)
    if (mode === 'admin') {
      router.push('/admin/dashboard')
    } else {
      router.push('/')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (pathname === '/admin/login') {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-bold text-gray-900">Admin Panel</h1>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link
                  href="/admin/dashboard"
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    pathname === '/admin/dashboard'
                      ? 'border-indigo-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Dashboard
                </Link>
                <Link
                  href="/admin/users"
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    pathname === '/admin/users'
                      ? 'border-indigo-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Users
                </Link>
                <Link
                  href="/admin/prices/global"
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    pathname === '/admin/prices/global'
                      ? 'border-indigo-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Global Prices
                </Link>
                <Link
                  href="/admin/prices/users"
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    pathname === '/admin/prices/users'
                      ? 'border-indigo-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  User Prices
                </Link>
                <Link
                  href="/admin/settings"
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    pathname === '/admin/settings'
                      ? 'border-indigo-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Settings
                </Link>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {/* View Toggle */}
              <div className="inline-flex rounded-md shadow-sm" role="group">
                <button
                  type="button"
                  onClick={() => handleViewToggle('admin')}
                  className={`px-3 py-2 text-sm font-medium rounded-l-lg border ${
                    viewMode === 'admin'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                  title="Admin Panel"
                >
                  Admin
                </button>
                <button
                  type="button"
                  onClick={() => handleViewToggle('portal')}
                  className={`px-3 py-2 text-sm font-medium rounded-r-lg border ${
                    viewMode === 'portal'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                  title="Press Portal"
                >
                  Press Portal
                </button>
              </div>
              <span className="text-sm text-gray-700">{user?.email}</span>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoggingOut ? 'Logging out...' : 'Logout'}
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}


