'use client'

import { useAdmin } from '@/contexts/AdminContext'

/**
 * Hook to check if current user is admin
 * Uses global AdminContext for consistent admin status across all components
 */
export function useIsAdmin() {
  const { isAdmin } = useAdmin()
  return isAdmin
}

