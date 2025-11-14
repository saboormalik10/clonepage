'use client'

import { useState, useEffect } from 'react'
import { useUserId } from '@/hooks/useUserId'
import { useVisibilityChange } from '@/hooks/useVisibilityChange'

interface Bundle {
  name: string
  retailValue: string
  publications: string[]
}

interface Category {
  category: string
  bundles: Bundle[]
}

export default function PRBundlesTab() {
  const [data, setData] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const userId = useUserId()
  const { refreshTrigger } = useVisibilityChange()

  useEffect(() => {
    let isMounted = true
    
    const fetchData = async () => {
      try {
        setIsLoading(true)
        const { authenticatedFetch } = await import('@/lib/authenticated-fetch')
        const response = await authenticatedFetch('/api/pr-bundles')
        
        if (!isMounted) return
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
          console.error('❌ [PR Bundles] API error:', response.status, errorData)
          if (response.status === 401) {
            console.error('❌ [PR Bundles] Authentication failed - redirecting to login')
            window.location.href = '/login'
            return
          }
          throw new Error(`API error: ${response.status}`)
        }
        
        const responseData = await response.json()
        
        if (!isMounted) return
        
        // Handle new response format with data and priceAdjustments
        let bundlesData = responseData
        if (responseData && typeof responseData === 'object' && 'data' in responseData) {
          bundlesData = responseData.data
        }
        
        if (Array.isArray(bundlesData)) {
          setData(bundlesData)
        } else {
          console.warn('⚠️ [PR Bundles] Unexpected data format:', bundlesData)
          setData([])
        }
      } catch (error) {
        console.error('Error fetching PR bundles:', error)
        if (isMounted) {
          setData([])
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    fetchData()
    
    return () => {
      isMounted = false
    }
  }, [refreshTrigger]) // Re-fetch when tab becomes visible

  if (isLoading) {
    return (
      <div className="opacity-100">
        <div className="flex items-center justify-center p-8">
          <p className="text-gray-500">Loading PR bundles...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="opacity-100">
      <div>
        {data.map((category: Category, categoryIndex: number) => (
          <div key={categoryIndex} className="flex flex-col mb-4">
            <h2 className="font-body font-medium text-lg my-2 uppercase">
              {category.category}
            </h2>
            <div className="grid grid-cols-1 grid-flow-row md:grid-flow-col md:grid-cols-3 gap-4">
              {category.bundles.map((bundle: Bundle, bundleIndex: number) => (
                <div key={bundleIndex} className="bg-white p-1 font-body text-sm">
                  <h3 className="font-medium bg-primary/20 text-primary p-1">
                    {bundle.name}
                  </h3>
                  <h3 className="bg-gray-50 p-1">{bundle.retailValue}</h3>
                  <ul className="list-decimal ml-6 mt-2 mb-2">
                    {bundle.publications.map((publication: string, pubIndex: number) => (
                      <li key={pubIndex}>{publication}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

