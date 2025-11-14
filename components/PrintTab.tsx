'use client'

import { useState, useEffect } from 'react'
import { useUserId } from '@/hooks/useUserId'
import { useVisibilityChange } from '@/hooks/useVisibilityChange'

interface Magazine {
  name: string
  url: string
  details: string[]
}

interface Category {
  category: string
  magazines: Magazine[]
}

export default function PrintTab() {
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
        const response = await authenticatedFetch('/api/print')
        
        if (!isMounted) return
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
          console.error('❌ [Print] API error:', response.status, errorData)
          if (response.status === 401) {
            console.error('❌ [Print] Authentication failed - redirecting to login')
            window.location.href = '/login'
            return
          }
          throw new Error(`API error: ${response.status}`)
        }
        
        const responseData = await response.json()
        
        if (!isMounted) return
        
        // Handle new response format with data and priceAdjustments
        let printData = responseData
        if (responseData && typeof responseData === 'object' && 'data' in responseData) {
          printData = responseData.data
        }
        
        if (Array.isArray(printData)) {
          setData(printData)
        } else {
          console.warn('⚠️ [Print] Unexpected data format:', printData)
          setData([])
        }
      } catch (error) {
        console.error('Error fetching print data:', error)
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
          <p className="text-gray-500">Loading print data...</p>
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
            {category.magazines.map((magazine: Magazine, magIndex: number) => (
              <div key={magIndex} className="flex flex-col font-body mb-3">
                <div className="bg-white p-3">
                  <p className="text-primary font-medium mb-1">
                    <a href={magazine.url} target="_blank" rel="noopener noreferrer">
                      {magazine.name}
                    </a>
                  </p>
                  {magazine.details.map((detail: string, detailIndex: number) => (
                    <p key={detailIndex} className="text-slate-600 text-sm">
                      {detail}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

