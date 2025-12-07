'use client'

import { useState, useEffect, useCallback } from 'react'
import { Tab } from '@headlessui/react'
import { useVisibilityChange } from '@/hooks/useVisibilityChange'
import { useIsAdmin } from '@/hooks/useIsAdmin'
import BroadcastTelevisionTab from './BroadcastTelevisionTab'
import PublicationsTab from './PublicationsTab'
import DigitalTelevisionTab from './DigitalTelevisionTab'
import ListiclesTab from './ListiclesTab'
import BestSellersTab from './BestSellersTab'
import PRBundlesTab from './PRBundlesTab'
import PrintTab from './PrintTab'
import SocialPostTab from './SocialPostTab'
import OthersTab from './OthersTab'

const allTabs = [
  { name: 'PUBLICATIONS', id: 'publications', component: PublicationsTab },
  { name: 'BROADCAST TELEVISION', id: 'broadcast', component: BroadcastTelevisionTab },
  { name: 'DIGITAL TELEVISION', id: 'digital', component: DigitalTelevisionTab },
  { name: 'LISTICLES', id: 'listicles', component: ListiclesTab },
  { name: 'BEST SELLERS', id: 'bestsellers', component: BestSellersTab },
  // { name: 'PR BUNDLES', id: 'prbundles', component: PRBundlesTab },
  { name: 'PRINT', id: 'print', component: PrintTab },
  { name: 'SOCIAL POST', id: 'socialpost', component: SocialPostTab },
  { name: 'OTHERS', id: 'others', component: OthersTab },
]

export default function PricingTabs() {
  const [visibleTabs, setVisibleTabs] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [hasLoaded, setHasLoaded] = useState(false) // Track if we've successfully loaded visibility data
  const { refreshTrigger } = useVisibilityChange()
  const isAdmin = useIsAdmin()

  const fetchTabVisibility = useCallback(async () => {
    // Admins always see all tabs, so skip fetching visibility
    if (isAdmin) {
      setVisibleTabs(allTabs.map(tab => tab.id))
      setLoading(false)
      setHasLoaded(true)
      return
    }

    // Only show loading on initial load, not on refreshes
    if (!hasLoaded) {
      setLoading(true)
    }

    try {
      // Add cache-busting timestamp to prevent browser caching
      const response = await fetch(`/api/tab-visibility?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        }
      })
      if (response.ok) {
        const result = await response.json()
        // The API already filters for is_visible=true, so we just need to extract tab_ids
        const visibleTabIds = (result.data || []).map((tab: any) => tab.tab_id)
        console.log('📊 [PricingTabs] Visible tabs from API:', visibleTabIds)
        setVisibleTabs(visibleTabIds)
        setHasLoaded(true)
      } else {
        console.error('❌ [PricingTabs] API error:', response.status)
        // On API error, show all tabs as fallback only if we haven't loaded before
        if (!hasLoaded) {
          setVisibleTabs(allTabs.map(tab => tab.id))
          setHasLoaded(true)
        }
      }
    } catch (error) {
      console.error('❌ [PricingTabs] Error fetching tab visibility:', error)
      // On error, show all tabs as fallback only if we haven't loaded before
      if (!hasLoaded) {
        setVisibleTabs(allTabs.map(tab => tab.id))
        setHasLoaded(true)
      }
    } finally {
      setLoading(false)
    }
  }, [isAdmin, hasLoaded])

  useEffect(() => {
    fetchTabVisibility()
  }, [fetchTabVisibility, refreshTrigger]) // Re-fetch when tab becomes visible

  // Also poll for changes every 30 seconds (in case admin changes settings) - only for non-admins
  useEffect(() => {
    if (isAdmin) return // Admins don't need polling

    const interval = setInterval(() => {
      fetchTabVisibility()
    }, 30000) // Poll every 30 seconds (reduced from 5 seconds for better performance)

    return () => clearInterval(interval)
  }, [fetchTabVisibility, isAdmin])

  // Admins see all tabs, regular users see filtered tabs
  // Don't show anything until we've loaded (prevents flash of hidden tabs)
  const displayTabs = isAdmin 
    ? allTabs 
    : (hasLoaded 
        ? allTabs.filter(tab => visibleTabs.includes(tab.id)) // Respect the visibility settings
        : [] // Show nothing while loading to prevent flash
      )
  const defaultIndex = displayTabs.length > 0 ? 0 : 0

  // Show loading state while fetching visibility (only for non-admins)
  if (!isAdmin && !hasLoaded && loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-gray-500">Loading...</p>
      </div>
    )
  }

  // If no tabs are visible after loading, show a message
  if (!isAdmin && hasLoaded && displayTabs.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-gray-500">No tabs available at this time.</p>
      </div>
    )
  }

  return (
    <Tab.Group defaultIndex={defaultIndex}>
      <Tab.List className="space-x-2 font-body border-b-2 pb-2">
        {displayTabs.map((tab) => (
          <Tab
            key={tab.id}
            className={({ selected }) =>
              `p-2 cursor-pointer outline-none text-sm rounded-sm ${
                selected
                  ? 'bg-primary/[15%] text-primary'
                  : 'hover:bg-primary/5 hover:text-primary'
              }`
            }
          >
            <span className="relative">
              {tab.name}
            </span>
          </Tab>
        ))}
      </Tab.List>
      <Tab.Panels>
        {displayTabs.map((tab) => {
          const Component = tab.component
          return (
            <Tab.Panel key={tab.id}>
              <Component />
            </Tab.Panel>
          )
        })}
      </Tab.Panels>
    </Tab.Group>
  )
}

