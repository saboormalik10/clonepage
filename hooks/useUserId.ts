'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase-client'

export function useUserId() {
  const [userId, setUserId] = useState<string | null>(null)
  // Use useMemo to ensure we get the same client instance
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const getUserId = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUserId(session?.user?.id || null)
    }

    getUserId()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id || null)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  return userId
}


