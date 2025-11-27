'use client'

import { useState, useEffect, useCallback } from 'react'
import { useUserId } from '@/hooks/useUserId'
import { useIsAdmin } from '@/hooks/useIsAdmin'
import { useVisibilityChange } from '@/hooks/useVisibilityChange'
import { createClient } from '@/lib/supabase-client'
import { isPriceAdjusted, getAdjustmentInfo, hasActiveAdjustments } from '@/lib/price-adjustment-utils'
import AddBestSellerForm from './AddBestSellerForm'

interface BestSeller {
  id?: string
  publication: string
  image: string | any
  genres: string
  price: string
  da: string
  dr: string
  tat: string
  region: string
  sponsored: string
  indexed: string
  dofollow: string
  exampleUrl: string
  hasImage: string
  niches: string
}

export default function BestSellersTab() {
  const [bestSellersData, setBestSellersData] = useState<BestSeller[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredData, setFilteredData] = useState<BestSeller[]>([])
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [hoveredColumn, setHoveredColumn] = useState<'example' | 'regions' | 'genres' | null>(null)
  const [hoveredNicheIcon, setHoveredNicheIcon] = useState<{index: number, niche: string} | null>(null)
  const [hoveredHeaderTooltip, setHoveredHeaderTooltip] = useState<'da' | 'dr' | 'tat' | null>(null)
  const [priceAdjustments, setPriceAdjustments] = useState<any>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingRecord, setEditingRecord] = useState<BestSeller | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null)

  const userId = useUserId()
  const isAdmin = useIsAdmin()
  const { refreshTrigger } = useVisibilityChange()
  const supabase = createClient()

  // Refetch best sellers data (reusable function)
  const fetchData = useCallback(async () => {
    try {
      // Only show loading on initial load, not on refreshes
      if (!hasLoaded) {
        setIsLoading(true)
      }
      const { authenticatedFetch } = await import('@/lib/authenticated-fetch')
      const response = await authenticatedFetch('/api/best-sellers')
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('❌ [Best Sellers] API error:', response.status, errorData)
        if (response.status === 401) {
          console.error('❌ [Best Sellers] Authentication failed - checking localStorage...')
          const { shouldRedirectToLogin } = await import('@/lib/authenticated-fetch')
          if (shouldRedirectToLogin()) {
            window.location.href = '/login'
            return
          } else {
            console.log('✅ [Best Sellers] Valid localStorage session, continuing...')
            return // Don't throw error, just return
          }
        }
        throw new Error(`API error: ${response.status}`)
      }
      
      const responseData = await response.json()
      
      // Handle new response format with data and priceAdjustments
      let data = responseData
      if (responseData && typeof responseData === 'object' && 'data' in responseData) {
        data = responseData.data
        setPriceAdjustments(responseData.priceAdjustments)
      }
      
      if (Array.isArray(data)) {
        setBestSellersData(data)
        setFilteredData(data)
        setHasLoaded(true)
      } else {
        console.warn('⚠️ [Best Sellers] Unexpected data format:', data)
        setBestSellersData([])
        setFilteredData([])
        setHasLoaded(true)
      }
    } catch (error) {
      console.error('Error fetching best sellers:', error)
      setBestSellersData([])
      setFilteredData([])
      setHasLoaded(true)
    } finally {
      setIsLoading(false)
    }
  }, [hasLoaded])

  // Fetch best sellers data from API on mount and when tab becomes visible
  useEffect(() => {
    fetchData()
  }, [fetchData, refreshTrigger]) // Re-fetch when tab becomes visible

  const getAuthToken = () => {
    try {
      // Get Supabase project ref from URL
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
          const now = Date.now()
          if (expiresAt > now) {
            return parsed.access_token
          }
        }
      }
    } catch (error) {
      console.error('Error getting token from localStorage:', error)
    }
    return ''
  }

  // Transform API response (snake_case) to BestSeller format (camelCase)
  const transformApiRecordToBestSeller = (apiRecord: any): BestSeller => {
    // Parse image if it's a stringified JSON
    let image = apiRecord.image
    if (typeof image === 'string') {
      try {
        const parsed = JSON.parse(image)
        if (parsed && typeof parsed === 'object') {
          image = parsed
        }
      } catch (e) {
        // If parsing fails, keep as string
      }
    }

    return {
      id: apiRecord.id,
      publication: apiRecord.publication,
      image: image,
      genres: apiRecord.genres || '',
      price: apiRecord.price || '',
      da: apiRecord.da || '',
      dr: apiRecord.dr || '',
      tat: apiRecord.tat || '',
      region: apiRecord.region || '',
      sponsored: apiRecord.sponsored || '',
      indexed: apiRecord.indexed || '',
      dofollow: apiRecord.dofollow || '',
      exampleUrl: apiRecord.example_url || '',
      hasImage: apiRecord.has_image || '',
      niches: apiRecord.niches || '',
    }
  }

  const handleCreateRecord = useCallback(async (formData: any) => {
    setError('')
    setSuccess('')

    try {
      // Transform data from publications-style form to best_sellers table schema
      // Convert arrays to comma-separated strings for best_sellers table
      const genresString = formData.genres && formData.genres.length > 0
        ? formData.genres.map((g: any) => g.name).filter(Boolean).join(', ')
        : null

      const regionsString = formData.regions && formData.regions.length > 0
        ? formData.regions.map((r: any) => r.name).filter(Boolean).join(', ')
        : null

      // Convert price arrays to text format
      // Use defaultPrice
      // Format as comma-separated values
      let priceString: string | null = null
      if (formData.defaultPrice && formData.defaultPrice.length > 0) {
        priceString = formData.defaultPrice.map((p: number) => `$${p}`).join(', ')
      }

      // Use logo as image
      const imageValue = formData.logo || null

      // Convert niches from boolean checkboxes to text format with default price
      // Format: "Health: $75, Crypto: $100" (with prices from defaultPrice)
      // Get the first price from defaultPrice array, or use 0 as fallback
      const basePrice = formData.defaultPrice && formData.defaultPrice.length > 0 
        ? formData.defaultPrice[0] 
        : 0
      
      const nichesArray: string[] = []
      if (formData.health) {
        nichesArray.push(`Health: $${basePrice.toLocaleString()}`)
      }
      if (formData.cbd) {
        nichesArray.push(`CBD: $${basePrice.toLocaleString()}`)
      }
      if (formData.crypto) {
        nichesArray.push(`Crypto: $${basePrice.toLocaleString()}`)
      }
      if (formData.gambling) {
        nichesArray.push(`Gambling: $${basePrice.toLocaleString()}`)
      }
      if (formData.erotic) {
        nichesArray.push(`Erotic: $${basePrice.toLocaleString()}`)
      }
      const nichesString = nichesArray.length > 0 ? nichesArray.join(', ') : null

      // Transform data for Supabase (snake_case)
      const transformedData: any = {
        publication: formData.name?.trim() || null,
        image: imageValue,
        genres: genresString,
        price: priceString,
        da: formData.domain_authority != null ? String(formData.domain_authority) : null,
        dr: formData.domain_rating != null ? String(formData.domain_rating) : null,
        tat: formData.estimated_time?.trim() || null,
        region: regionsString,
        sponsored: formData.sponsored?.trim() || null,
        indexed: formData.indexed?.trim() || null,
        dofollow: formData.do_follow?.trim() || null,
        example_url: formData.example_url?.trim() || null,
        niches: nichesString,
      }

      // Convert all empty strings, undefined, and falsy values to null
      Object.keys(transformedData).forEach(key => {
        const value = transformedData[key]
        
        // Convert empty strings to null
        if (value === '') {
          transformedData[key] = null
        }
        
        // Convert undefined to null
        if (value === undefined) {
          transformedData[key] = null
        }
        
        // Convert empty arrays to null
        if (Array.isArray(value) && value.length === 0) {
          transformedData[key] = null
        }
      })

      // Ensure image/logo is properly formatted - if it's an object, stringify it for storage
      if (transformedData.image && typeof transformedData.image === 'object') {
        // Stringify the logo object so it can be parsed later
        transformedData.image = JSON.stringify(transformedData.image)
        console.log('📸 Image/Logo stringified:', transformedData.image)
      } else if (!transformedData.image) {
        transformedData.image = null
      }

      const token = getAuthToken()
      console.log('📤 Sending data to API:', transformedData)
      
      const response = await fetch('/api/admin/records/best-sellers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(transformedData)
      })

      const data = await response.json()
      console.log('📥 API Response:', data)

      if (!response.ok) {
        console.error('❌ API Error:', data)
        throw new Error(data.error || 'Failed to create record')
      }

      if (!data.success && !data.record) {
        console.error('❌ Unexpected response format:', data)
        throw new Error('Unexpected response from server')
      }

      // Transform API response to BestSeller format and add to state
      const newBestSeller = transformApiRecordToBestSeller(data.record)
      
      // Add new record to bestSellersData
      setBestSellersData(prev => [...prev, newBestSeller])
      
      // Update filtered data if it matches the search term
      const term = searchTerm.toLowerCase()
      if (!term || 
          newBestSeller.publication.toLowerCase().includes(term) ||
          newBestSeller.genres.toLowerCase().includes(term) ||
          newBestSeller.region.toLowerCase().includes(term)) {
        setFilteredData(prev => [...prev, newBestSeller])
      }
      
      setSuccess('Record created successfully!')
      // Close modal and clear messages after a short delay
      setTimeout(() => {
        setShowAddModal(false)
        setSuccess('')
        setError('')
      }, 1500)
    } catch (err: any) {
      console.error('Error creating record:', err)
      setError(err.message || 'Failed to create record')
    }
  }, [searchTerm])

  const handleUpdateRecord = useCallback(async (formData: any) => {
    if (!editingRecord || !editingRecord.id) return

    setError('')
    setSuccess('')

    try {
      // Transform data from publications-style form to best_sellers table schema
      const genresString = formData.genres && formData.genres.length > 0
        ? formData.genres.map((g: any) => g.name).filter(Boolean).join(', ')
        : null

      const regionsString = formData.regions && formData.regions.length > 0
        ? formData.regions.map((r: any) => r.name).filter(Boolean).join(', ')
        : null

      // Convert price arrays to text format
      let priceString: string | null = null
      if (formData.defaultPrice && formData.defaultPrice.length > 0) {
        priceString = formData.defaultPrice.map((p: number) => `$${p}`).join(', ')
      }

      // Use logo as image
      const imageValue = formData.logo || null

      // Convert niches from boolean checkboxes to text format with default price
      // Format: "Health: $75, Crypto: $100" (with prices from defaultPrice)
      // Get the first price from defaultPrice array, or use 0 as fallback
      const basePrice = formData.defaultPrice && formData.defaultPrice.length > 0 
        ? formData.defaultPrice[0] 
        : 0
      
      const nichesArray: string[] = []
      if (formData.health) {
        nichesArray.push(`Health: $${basePrice.toLocaleString()}`)
      }
      if (formData.cbd) {
        nichesArray.push(`CBD: $${basePrice.toLocaleString()}`)
      }
      if (formData.crypto) {
        nichesArray.push(`Crypto: $${basePrice.toLocaleString()}`)
      }
      if (formData.gambling) {
        nichesArray.push(`Gambling: $${basePrice.toLocaleString()}`)
      }
      if (formData.erotic) {
        nichesArray.push(`Erotic: $${basePrice.toLocaleString()}`)
      }
      const nichesString = nichesArray.length > 0 ? nichesArray.join(', ') : null

      // Transform data for Supabase (snake_case)
      const transformedData: any = {
        id: editingRecord.id, // Keep existing id
        publication: formData.name?.trim() || null,
        image: imageValue,
        genres: genresString,
        price: priceString,
        da: formData.domain_authority != null ? String(formData.domain_authority) : null,
        dr: formData.domain_rating != null ? String(formData.domain_rating) : null,
        tat: formData.estimated_time?.trim() || null,
        region: regionsString,
        sponsored: formData.sponsored?.trim() || null,
        indexed: formData.indexed?.trim() || null,
        dofollow: formData.do_follow?.trim() || null,
        example_url: formData.example_url?.trim() || null,
        niches: nichesString,
      }

      // Convert all empty strings, undefined, and falsy values to null
      Object.keys(transformedData).forEach(key => {
        const value = transformedData[key]
        
        if (key === 'id' || key === 'image') {
          return
        }
        
        if (value === '') {
          transformedData[key] = null
        }
        
        if (value === undefined) {
          transformedData[key] = null
        }
        
        if (Array.isArray(value) && value.length === 0) {
          transformedData[key] = null
        }
      })

      // Ensure image/logo is properly formatted
      if (transformedData.image && typeof transformedData.image === 'object') {
        transformedData.image = JSON.stringify(transformedData.image)
      } else if (!transformedData.image) {
        transformedData.image = null
      }

      const token = getAuthToken()
      
      if (!token) {
        throw new Error('No authentication token found. Please log in again.')
      }

      const response = await fetch(`/api/admin/records/best-sellers?id=${editingRecord.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(transformedData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update record')
      }

      if (!data.success && !data.record) {
        throw new Error('Unexpected response from server')
      }

      // Transform API response to BestSeller format and update state
      const updatedBestSeller = transformApiRecordToBestSeller(data.record)
      
      // Update record in bestSellersData
      setBestSellersData(prev => prev.map(item => 
        item.id === editingRecord.id ? updatedBestSeller : item
      ))
      
      // Update filtered data as well
      setFilteredData(prev => prev.map(item => 
        item.id === editingRecord.id ? updatedBestSeller : item
      ))
      
      setSuccess('Record updated successfully!')
      setTimeout(() => {
        setShowAddModal(false)
        setEditingRecord(null)
        setSuccess('')
        setError('')
      }, 1500)
    } catch (err: any) {
      console.error('❌ Error updating record:', err)
      setError(err.message || 'Failed to update record')
    }
  }, [editingRecord])

  const handleDeleteRecord = useCallback(async (recordId: string) => {
    if (!recordId) {
      console.error('❌ No record ID provided for deletion')
      setError('No record ID found. Cannot delete.')
      return
    }

    if (!confirm('Are you sure you want to delete this record?')) return

    try {
      setDeletingRecordId(recordId)
      setError('')
      setSuccess('')
      
      console.log('🗑️ Deleting best seller with ID:', recordId)
      const token = getAuthToken()
      const response = await fetch(`/api/admin/records/best-sellers?id=${recordId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('❌ Delete failed:', data)
        throw new Error(data.error || 'Failed to delete record')
      }

      // Remove record from state instead of refetching
      setBestSellersData(prev => prev.filter(item => item.id !== recordId))
      setFilteredData(prev => prev.filter(item => item.id !== recordId))
      
      console.log('✅ Record deleted successfully')
      setSuccess('Record deleted successfully!')
      // Clear messages after a short delay
      setTimeout(() => {
        setSuccess('')
        setError('')
      }, 1500)
    } catch (err: any) {
      console.error('❌ Error deleting record:', err)
      setError(err.message || 'Failed to delete record')
    } finally {
      setDeletingRecordId(null)
    }
  }, [])

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value.toLowerCase()
    setSearchTerm(term)
    const filtered = bestSellersData.filter(
      (item) =>
        item.publication.toLowerCase().includes(term) ||
        item.genres.toLowerCase().includes(term) ||
        item.region.toLowerCase().includes(term)
    )
    setFilteredData(filtered)
  }

  // Parse niches string to extract niche info with prices
  const parseNiches = (nichesString: string) => {
    if (!nichesString) return []
    
    const nicheData: Array<{
      name: string
      displayName: string
      icon: string
      price: string | null
      accepted: boolean
    }> = []
    const nicheMap: Record<string, { displayName: string; icon: string }> = {
      'Health': { displayName: 'health content', icon: 'health' },
      'CBD': { displayName: 'Cbd content', icon: 'cbd' },
      'Crypto': { displayName: 'Crypto content', icon: 'crypto' },
      'Gambling': { displayName: 'Gambling content', icon: 'gambling' },
      'Erotic': { displayName: 'erotic', icon: 'erotic' }
    }
    
    // Parse string - handle both formats:
    // With prices: "Health: $75, CBD: $75, Crypto: $75"
    // Without prices: "Health, CBD, Crypto"
    const parts = nichesString.split(', ')
    const acceptedNiches: string[] = []
    
    parts.forEach(part => {
      if (part.includes(': ')) {
        // Format with price: "Health: $75"
        const [nicheName, priceStr] = part.split(': ')
        if (nicheName && priceStr) {
          const nicheInfo = nicheMap[nicheName]
          if (nicheInfo) {
            nicheData.push({
              name: nicheName,
              displayName: nicheInfo.displayName,
              icon: nicheInfo.icon,
              price: priceStr,
              accepted: true
            })
            acceptedNiches.push(nicheName)
          }
        }
      } else {
        // Format without price: "Health"
        const nicheName = part.trim()
        const nicheInfo = nicheMap[nicheName]
        if (nicheInfo) {
          nicheData.push({
            name: nicheName,
            displayName: nicheInfo.displayName,
            icon: nicheInfo.icon,
            price: null,
            accepted: true
          })
          acceptedNiches.push(nicheName)
        }
      }
    })
    
    // Add non-accepted niches (those not in the string)
    Object.keys(nicheMap).forEach(nicheName => {
      if (!acceptedNiches.includes(nicheName)) {
        nicheData.push({
          name: nicheName,
          displayName: nicheMap[nicheName].displayName,
          icon: nicheMap[nicheName].icon,
          price: null,
          accepted: false
        })
      }
    })
    
    // Sort to maintain consistent order: Erotic, Health, CBD, Crypto, Gambling
    const order = ['Erotic', 'Health', 'CBD', 'Crypto', 'Gambling']
    return nicheData.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name))
  }

  const formatGenres = (genresString: string, index: number) => {
    if (!genresString) return '-'
    
    // Split comma-separated genres
    const genresArray = genresString.split(',').map(g => g.trim()).filter(Boolean)
    
    if (genresArray.length === 0) {
      return '-'
    }
    
    // If more than 2 genres, show count with tooltip and question mark icon
    if (genresArray.length > 2) {
      return (
        <div className="relative inline-block">
          <div
            className="flex flex-col items-center space-y-1"
            onMouseEnter={() => {
              setHoveredIndex(index)
              setHoveredColumn('genres')
            }}
            onMouseLeave={() => {
              setHoveredIndex(null)
              setHoveredColumn(null)
            }}
          >
            <div className="flex items-center">
              <span className="mr-1 text-gray-500">{genresArray.length} genres</span>
              <button className="inline-flex items-center justify-center" data-state="closed">
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M0.877075 7.49972C0.877075 3.84204 3.84222 0.876892 7.49991 0.876892C11.1576 0.876892 14.1227 3.84204 14.1227 7.49972C14.1227 11.1574 11.1576 14.1226 7.49991 14.1226C3.84222 14.1226 0.877075 11.1574 0.877075 7.49972ZM7.49991 1.82689C4.36689 1.82689 1.82708 4.36671 1.82708 7.49972C1.82708 10.6327 4.36689 13.1726 7.49991 13.1726C10.6329 13.1726 13.1727 10.6327 13.1727 7.49972C13.1727 4.36671 10.6329 1.82689 7.49991 1.82689ZM8.24993 10.5C8.24993 10.9142 7.91414 11.25 7.49993 11.25C7.08571 11.25 6.74993 10.9142 6.74993 10.5C6.74993 10.0858 7.08571 9.75 7.49993 9.75C7.91414 9.75 8.24993 10.0858 8.24993 10.5ZM6.05003 6.25C6.05003 5.57211 6.63511 4.925 7.50003 4.925C8.36496 4.925 8.95003 5.57211 8.95003 6.25C8.95003 6.74118 8.68002 6.99212 8.21447 7.27494C8.16251 7.30651 8.10258 7.34131 8.03847 7.37854L8.03841 7.37858C7.85521 7.48497 7.63788 7.61119 7.47449 7.73849C7.23214 7.92732 6.95003 8.23198 6.95003 8.7C6.95004 9.00376 7.19628 9.25 7.50004 9.25C7.8024 9.25 8.04778 9.00601 8.05002 8.70417L8.05056 8.7033C8.05924 8.6896 8.08493 8.65735 8.15058 8.6062C8.25207 8.52712 8.36508 8.46163 8.51567 8.37436L8.51571 8.37433C8.59422 8.32883 8.68296 8.27741 8.78559 8.21506C9.32004 7.89038 10.05 7.35382 10.05 6.25C10.05 4.92789 8.93511 3.825 7.50003 3.825C6.06496 3.825 4.95003 4.92789 4.95003 6.25C4.95003 6.55376 5.19628 6.8 5.50003 6.8C5.80379 6.8 6.05003 6.55376 6.05003 6.25Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
          
          {hoveredIndex === index && hoveredColumn === 'genres' && (
            <div
              data-radix-popper-content-wrapper=""
              className="absolute z-50 left-1/2 transform -translate-x-1/2 bottom-full mb-2"
              style={{
                minWidth: 'max-content',
                willChange: 'transform'
              }}
              onMouseEnter={(e: React.MouseEvent) => {
                e.stopPropagation()
                setHoveredIndex(index)
                setHoveredColumn('genres')
              }}
              onMouseLeave={(e: React.MouseEvent) => {
                e.stopPropagation()
                setHoveredIndex(null)
                setHoveredColumn(null)
              }}
            >
              <div
                data-side="top"
                data-align="center"
                data-state="instant-open"
                className="select-none rounded-[4px] bg-white px-[15px] py-[10px] text-[15px] leading-none shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,_hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px] will-change-[transform,opacity] border-2 pointer-events-auto"
              >
                <div className="flex flex-wrap gap-1">
                  {genresArray.map((genre, gIndex) => (
                    <span 
                      key={gIndex} 
                      className="text-xs font-medium mr-1 px-2.5 py-0.5 rounded bg-gray-100 text-gray-800"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
                <span style={{ position: 'absolute', bottom: '0px', transform: 'translateY(100%)', left: '50%', marginLeft: '-5px' }}>
                  <svg className="fill-white" width="10" height="5" viewBox="0 0 30 10" preserveAspectRatio="none" style={{ display: 'block' }}>
                    <polygon points="0,0 30,0 15,10"></polygon>
                  </svg>
                </span>
              </div>
            </div>
          )}
        </div>
      )
    }
    
    // If 2 or fewer genres, display as vertical badges
    return (
      <div className="flex flex-col items-center gap-1">
        {genresArray.map((genre, gIndex) => (
          <span 
            key={gIndex} 
            className="text-xs font-medium px-2.5 py-0.5 rounded bg-gray-100 text-gray-800"
          >
            {genre}
          </span>
        ))}
      </div>
    )
  }

  const formatRegions = (regionsString: string, index: number) => {
    if (!regionsString) return '-'
    
    // Parse concatenated regions - handle patterns like "GlobalUnited States", "Middle EastUAE"
    const regions: string[] = []
    
    // Common patterns to split on
    const patterns = [
      'Global',
      'United States',
      'United Kingdom',
      'Middle East',
      'UAE',
      'Florida',
      'California',
      'New York',
      'Texas',
      'Europe',
      'Asia',
      'Africa',
      'Australia',
      'Canada',
      'Mexico',
      'South America',
      'North America'
    ]
    
    let remaining = regionsString
    for (const pattern of patterns) {
      if (remaining.includes(pattern)) {
        regions.push(pattern)
        remaining = remaining.replace(pattern, '')
      }
    }
    
    // If no patterns matched, just use the original string
    if (regions.length === 0) {
      regions.push(regionsString)
    }
    
    // If more than 2 regions, show count with tooltip and question mark icon
    if (regions.length > 2) {
      return (
        <div className="relative inline-block">
          <div
            className="flex flex-col items-center space-y-1"
            onMouseEnter={() => {
              setHoveredIndex(index)
              setHoveredColumn('regions')
            }}
            onMouseLeave={() => {
              setHoveredIndex(null)
              setHoveredColumn(null)
            }}
          >
            <div className="flex items-center">
              <span className="mr-1 text-gray-500">{regions.length} regions</span>
              <button className="inline-flex items-center justify-center" data-state="closed">
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M0.877075 7.49972C0.877075 3.84204 3.84222 0.876892 7.49991 0.876892C11.1576 0.876892 14.1227 3.84204 14.1227 7.49972C14.1227 11.1574 11.1576 14.1226 7.49991 14.1226C3.84222 14.1226 0.877075 11.1574 0.877075 7.49972ZM7.49991 1.82689C4.36689 1.82689 1.82708 4.36671 1.82708 7.49972C1.82708 10.6327 4.36689 13.1726 7.49991 13.1726C10.6329 13.1726 13.1727 10.6327 13.1727 7.49972C13.1727 4.36671 10.6329 1.82689 7.49991 1.82689ZM8.24993 10.5C8.24993 10.9142 7.91414 11.25 7.49993 11.25C7.08571 11.25 6.74993 10.9142 6.74993 10.5C6.74993 10.0858 7.08571 9.75 7.49993 9.75C7.91414 9.75 8.24993 10.0858 8.24993 10.5ZM6.05003 6.25C6.05003 5.57211 6.63511 4.925 7.50003 4.925C8.36496 4.925 8.95003 5.57211 8.95003 6.25C8.95003 6.74118 8.68002 6.99212 8.21447 7.27494C8.16251 7.30651 8.10258 7.34131 8.03847 7.37854L8.03841 7.37858C7.85521 7.48497 7.63788 7.61119 7.47449 7.73849C7.23214 7.92732 6.95003 8.23198 6.95003 8.7C6.95004 9.00376 7.19628 9.25 7.50004 9.25C7.8024 9.25 8.04778 9.00601 8.05002 8.70417L8.05056 8.7033C8.05924 8.6896 8.08493 8.65735 8.15058 8.6062C8.25207 8.52712 8.36508 8.46163 8.51567 8.37436L8.51571 8.37433C8.59422 8.32883 8.68296 8.27741 8.78559 8.21506C9.32004 7.89038 10.05 7.35382 10.05 6.25C10.05 4.92789 8.93511 3.825 7.50003 3.825C6.06496 3.825 4.95003 4.92789 4.95003 6.25C4.95003 6.55376 5.19628 6.8 5.50003 6.8C5.80379 6.8 6.05003 6.55376 6.05003 6.25Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
          
          {hoveredIndex === index && hoveredColumn === 'regions' && (
            <div
              data-radix-popper-content-wrapper=""
              className="absolute z-50 left-1/2 transform -translate-x-1/2 bottom-full mb-2"
              style={{
                minWidth: 'max-content',
                willChange: 'transform'
              }}
              onMouseEnter={(e: React.MouseEvent) => {
                e.stopPropagation()
                setHoveredIndex(index)
                setHoveredColumn('regions')
              }}
              onMouseLeave={(e: React.MouseEvent) => {
                e.stopPropagation()
                setHoveredIndex(null)
                setHoveredColumn(null)
              }}
            >
              <div
                data-side="top"
                data-align="center"
                data-state="instant-open"
                className="select-none rounded-[4px] bg-white px-[15px] py-[10px] text-[15px] leading-none shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,_hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px] will-change-[transform,opacity] border-2 pointer-events-auto"
              >
                <div className="flex flex-wrap gap-1">
                  {regions.map((region, rIndex) => (
                    <span 
                      key={rIndex} 
                      className="text-xs font-medium mr-1 px-2.5 py-0.5 rounded bg-gray-100 text-gray-800"
                    >
                      {region}
                    </span>
                  ))}
                </div>
                <span style={{ position: 'absolute', bottom: '0px', transform: 'translateY(100%)', left: '50%', marginLeft: '-5px' }}>
                  <svg className="fill-white" width="10" height="5" viewBox="0 0 30 10" preserveAspectRatio="none" style={{ display: 'block' }}>
                    <polygon points="0,0 30,0 15,10"></polygon>
                  </svg>
                </span>
              </div>
            </div>
          )}
        </div>
      )
    }
    
    // If 2 or fewer regions, display as vertical badges
    return (
      <div className="flex flex-col items-center gap-1">
        {regions.map((region, rIndex) => (
          <span 
            key={rIndex} 
            className="text-xs font-medium px-2.5 py-0.5 rounded bg-gray-100 text-gray-800"
          >
            {region}
          </span>
        ))}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="opacity-100">
        <div className="flex items-center justify-center p-8">
          <p className="text-gray-500">Loading best sellers...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="opacity-100">
      <div className="flex flex-col">
        <div className="mt-2">
          <div className="flex items-center justify-between mb-1">
            <p className="font-body text-sm">
              SHOWING {filteredData.length} OF {bestSellersData.length} PUBLICATIONS
            </p>
            {isAdmin && (
              <button
                onClick={() => {
                  setEditingRecord(null)
                  setShowAddModal(true)
                }}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Add Best Seller
              </button>
            )}
          </div>
          <div className="overflow-x-scroll lg:overflow-visible relative">
            <table className="w-full divide-y divide-gray-300 overflow-hidden lg:overflow-visible border bg-white">
              <thead className="text-xs text-gray-700 bg-white sticky -top-1 shadow-sm">
                <tr className="text-primary">
                  <th className="font-body font-medium border-l border-r uppercase p-2 px-2">
                    <div className="flex">Publication</div>
                  </th>
                  <th className="font-body font-medium border-l border-r uppercase p-2 px-2">
                    <div className="flex justify-center">Genres</div>
                  </th>
                  <th className="font-body font-medium border-l border-r uppercase p-2 px-2">
                    <div className="flex flex-col items-center">
                      <span>Price</span>
                      {hasActiveAdjustments(priceAdjustments) && !userId && (
                        <span className="text-xs font-normal text-blue-600 mt-1" title={getAdjustmentInfo(priceAdjustments)}>
                          (Adjusted)
                        </span>
                      )}
                    </div>
                  </th>
                  <th className="font-body font-medium border-l border-r uppercase p-2 px-2">
                    <div className="flex justify-center relative">
                      DA
                      <div 
                        className="relative inline-block"
                        onMouseEnter={() => setHoveredHeaderTooltip('da')}
                        onMouseLeave={() => setHoveredHeaderTooltip(null)}
                      >
                      <button className="text-gray-500 ml-1 inline-flex items-center justify-center" data-state="closed">
                        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M0.877075 7.49972C0.877075 3.84204 3.84222 0.876892 7.49991 0.876892C11.1576 0.876892 14.1227 3.84204 14.1227 7.49972C14.1227 11.1574 11.1576 14.1226 7.49991 14.1226C3.84222 14.1226 0.877075 11.1574 0.877075 7.49972ZM7.49991 1.82689C4.36689 1.82689 1.82708 4.36671 1.82708 7.49972C1.82708 10.6327 4.36689 13.1726 7.49991 13.1726C10.6329 13.1726 13.1727 10.6327 13.1727 7.49972C13.1727 4.36671 10.6329 1.82689 7.49991 1.82689ZM8.24993 10.5C8.24993 10.9142 7.91414 11.25 7.49993 11.25C7.08571 11.25 6.74993 10.9142 6.74993 10.5C6.74993 10.0858 7.08571 9.75 7.49993 9.75C7.91414 9.75 8.24993 10.0858 8.24993 10.5ZM6.05003 6.25C6.05003 5.57211 6.63511 4.925 7.50003 4.925C8.36496 4.925 8.95003 5.57211 8.95003 6.25C8.95003 6.74118 8.68002 6.99212 8.21447 7.27494C8.16251 7.30651 8.10258 7.34131 8.03847 7.37854L8.03841 7.37858C7.85521 7.48497 7.63788 7.61119 7.47449 7.73849C7.23214 7.92732 6.95003 8.23198 6.95003 8.7C6.95004 9.00376 7.19628 9.25 7.50004 9.25C7.8024 9.25 8.04778 9.00601 8.05002 8.70417L8.05056 8.7033C8.05924 8.6896 8.08493 8.65735 8.15058 8.6062C8.25207 8.52712 8.36508 8.46163 8.51567 8.37436L8.51571 8.37433C8.59422 8.32883 8.68296 8.27741 8.78559 8.21506C9.32004 7.89038 10.05 7.35382 10.05 6.25C10.05 4.92789 8.93511 3.825 7.50003 3.825C6.06496 3.825 4.95003 4.92789 4.95003 6.25C4.95003 6.55376 5.19628 6.8 5.50003 6.8C5.80379 6.8 6.05003 6.55376 6.05003 6.25Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
                        </svg>
                      </button>
                        {hoveredHeaderTooltip === 'da' && (
                          <div 
                            data-radix-popper-content-wrapper=""
                            className="absolute z-[9999] left-1/2 transform -translate-x-1/2 bottom-full mb-2"
                            style={{
                              minWidth: 'max-content',
                              willChange: 'transform',
                              position: 'absolute',
                              pointerEvents: 'auto'
                            }}
                            onMouseEnter={(e) => {
                              e.stopPropagation()
                              setHoveredHeaderTooltip('da')
                            }}
                            onMouseLeave={(e) => {
                              e.stopPropagation()
                              setHoveredHeaderTooltip(null)
                            }}
                          >
                            <div 
                              data-side="top" 
                              data-align="center" 
                              data-state="instant-open" 
                              className="select-none rounded-[4px] bg-white px-[15px] py-[10px] text-[13px] leading-normal shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,_hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px] will-change-[transform,opacity] border-2 pointer-events-auto text-left normal-case"
                            >
                              <h3 className="text-red-500 font-medium mb-1 normal-case">Domain authority</h3>
                              <p className="text-gray-500 normal-case">Search engine ranking score (1-100)</p>
                              <span style={{ position: 'absolute', bottom: '0px', transform: 'translateY(100%)', left: '50%', marginLeft: '-5px' }}>
                                <svg className="fill-white" width="10" height="5" viewBox="0 0 30 10" preserveAspectRatio="none" style={{ display: 'block' }}>
                                  <polygon points="0,0 30,0 15,10"></polygon>
                                </svg>
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </th>
                  <th className="font-body font-medium border-l border-r uppercase p-2 px-2">
                    <div className="flex justify-center relative">
                      DR
                      <div 
                        className="relative inline-block"
                        onMouseEnter={() => setHoveredHeaderTooltip('dr')}
                        onMouseLeave={() => setHoveredHeaderTooltip(null)}
                      >
                      <button className="text-gray-500 ml-1 inline-flex items-center justify-center" data-state="closed">
                        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M0.877075 7.49972C0.877075 3.84204 3.84222 0.876892 7.49991 0.876892C11.1576 0.876892 14.1227 3.84204 14.1227 7.49972C14.1227 11.1574 11.1576 14.1226 7.49991 14.1226C3.84222 14.1226 0.877075 11.1574 0.877075 7.49972ZM7.49991 1.82689C4.36689 1.82689 1.82708 4.36671 1.82708 7.49972C1.82708 10.6327 4.36689 13.1726 7.49991 13.1726C10.6329 13.1726 13.1727 10.6327 13.1727 7.49972C13.1727 4.36671 10.6329 1.82689 7.49991 1.82689ZM8.24993 10.5C8.24993 10.9142 7.91414 11.25 7.49993 11.25C7.08571 11.25 6.74993 10.9142 6.74993 10.5C6.74993 10.0858 7.08571 9.75 7.49993 9.75C7.91414 9.75 8.24993 10.0858 8.24993 10.5ZM6.05003 6.25C6.05003 5.57211 6.63511 4.925 7.50003 4.925C8.36496 4.925 8.95003 5.57211 8.95003 6.25C8.95003 6.74118 8.68002 6.99212 8.21447 7.27494C8.16251 7.30651 8.10258 7.34131 8.03847 7.37854L8.03841 7.37858C7.85521 7.48497 7.63788 7.61119 7.47449 7.73849C7.23214 7.92732 6.95003 8.23198 6.95003 8.7C6.95004 9.00376 7.19628 9.25 7.50004 9.25C7.8024 9.25 8.04778 9.00601 8.05002 8.70417L8.05056 8.7033C8.05924 8.6896 8.08493 8.65735 8.15058 8.6062C8.25207 8.52712 8.36508 8.46163 8.51567 8.37436L8.51571 8.37433C8.59422 8.32883 8.68296 8.27741 8.78559 8.21506C9.32004 7.89038 10.05 7.35382 10.05 6.25C10.05 4.92789 8.93511 3.825 7.50003 3.825C6.06496 3.825 4.95003 4.92789 4.95003 6.25C4.95003 6.55376 5.19628 6.8 5.50003 6.8C5.80379 6.8 6.05003 6.55376 6.05003 6.25Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
                        </svg>
                      </button>
                        {hoveredHeaderTooltip === 'dr' && (
                          <div 
                            data-radix-popper-content-wrapper=""
                            className="absolute z-[9999] left-1/2 transform -translate-x-1/2 bottom-full mb-2"
                            style={{
                              minWidth: 'max-content',
                              willChange: 'transform',
                              position: 'absolute',
                              pointerEvents: 'auto'
                            }}
                            onMouseEnter={(e) => {
                              e.stopPropagation()
                              setHoveredHeaderTooltip('dr')
                            }}
                            onMouseLeave={(e) => {
                              e.stopPropagation()
                              setHoveredHeaderTooltip(null)
                            }}
                          >
                            <div 
                              data-side="top" 
                              data-align="center" 
                              data-state="instant-open" 
                              className="select-none rounded-[4px] bg-white px-[15px] py-[10px] text-[13px] leading-normal shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,_hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px] will-change-[transform,opacity] border-2 pointer-events-auto text-left normal-case"
                            >
                              <h3 className="text-red-500 font-medium mb-1 normal-case">Domain rating</h3>
                              <p className="text-gray-500 normal-case">Search engine ranking score (1-100)</p>
                              <span style={{ position: 'absolute', bottom: '0px', transform: 'translateY(100%)', left: '50%', marginLeft: '-5px' }}>
                                <svg className="fill-white" width="10" height="5" viewBox="0 0 30 10" preserveAspectRatio="none" style={{ display: 'block' }}>
                                  <polygon points="0,0 30,0 15,10"></polygon>
                                </svg>
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </th>
                  <th className="font-body font-medium border-l border-r uppercase p-2 px-2">
                    <div className="flex justify-center relative">
                      TAT
                      <div 
                        className="relative inline-block"
                        onMouseEnter={() => setHoveredHeaderTooltip('tat')}
                        onMouseLeave={() => setHoveredHeaderTooltip(null)}
                      >
                      <button className="text-gray-500 ml-1 inline-flex items-center justify-center" data-state="closed">
                        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M0.877075 7.49972C0.877075 3.84204 3.84222 0.876892 7.49991 0.876892C11.1576 0.876892 14.1227 3.84204 14.1227 7.49972C14.1227 11.1574 11.1576 14.1226 7.49991 14.1226C3.84222 14.1226 0.877075 11.1574 0.877075 7.49972ZM7.49991 1.82689C4.36689 1.82689 1.82708 4.36671 1.82708 7.49972C1.82708 10.6327 4.36689 13.1726 7.49991 13.1726C10.6329 13.1726 13.1727 10.6327 13.1727 7.49972C13.1727 4.36671 10.6329 1.82689 7.49991 1.82689ZM8.24993 10.5C8.24993 10.9142 7.91414 11.25 7.49993 11.25C7.08571 11.25 6.74993 10.9142 6.74993 10.5C6.74993 10.0858 7.08571 9.75 7.49993 9.75C7.91414 9.75 8.24993 10.0858 8.24993 10.5ZM6.05003 6.25C6.05003 5.57211 6.63511 4.925 7.50003 4.925C8.36496 4.925 8.95003 5.57211 8.95003 6.25C8.95003 6.74118 8.68002 6.99212 8.21447 7.27494C8.16251 7.30651 8.10258 7.34131 8.03847 7.37854L8.03841 7.37858C7.85521 7.48497 7.63788 7.61119 7.47449 7.73849C7.23214 7.92732 6.95003 8.23198 6.95003 8.7C6.95004 9.00376 7.19628 9.25 7.50004 9.25C7.8024 9.25 8.04778 9.00601 8.05002 8.70417L8.05056 8.7033C8.05924 8.6896 8.08493 8.65735 8.15058 8.6062C8.25207 8.52712 8.36508 8.46163 8.51567 8.37436L8.51571 8.37433C8.59422 8.32883 8.68296 8.27741 8.78559 8.21506C9.32004 7.89038 10.05 7.35382 10.05 6.25C10.05 4.92789 8.93511 3.825 7.50003 3.825C6.06496 3.825 4.95003 4.92789 4.95003 6.25C4.95003 6.55376 5.19628 6.8 5.50003 6.8C5.80379 6.8 6.05003 6.55376 6.05003 6.25Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
                        </svg>
                      </button>
                        {hoveredHeaderTooltip === 'tat' && (
                          <div 
                            data-radix-popper-content-wrapper=""
                            className="absolute z-[9999] left-1/2 transform -translate-x-1/2 bottom-full mb-2"
                            style={{
                              minWidth: 'max-content',
                              willChange: 'transform',
                              position: 'absolute',
                              pointerEvents: 'auto'
                            }}
                            onMouseEnter={(e) => {
                              e.stopPropagation()
                              setHoveredHeaderTooltip('tat')
                            }}
                            onMouseLeave={(e) => {
                              e.stopPropagation()
                              setHoveredHeaderTooltip(null)
                            }}
                          >
                            <div 
                              data-side="top" 
                              data-align="center" 
                              data-state="instant-open" 
                              className="select-none rounded-[4px] bg-white px-[15px] py-[10px] text-[13px] leading-normal shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,_hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px] will-change-[transform,opacity] border-2 pointer-events-auto text-left normal-case"
                            >
                              <h3 className="text-red-500 font-medium mb-1 normal-case">Turn around time</h3>
                              <p className="text-gray-500 normal-case">Estimated time to deliver</p>
                              <span style={{ position: 'absolute', bottom: '0px', transform: 'translateY(100%)', left: '50%', marginLeft: '-5px' }}>
                                <svg className="fill-white" width="10" height="5" viewBox="0 0 30 10" preserveAspectRatio="none" style={{ display: 'block' }}>
                                  <polygon points="0,0 30,0 15,10"></polygon>
                                </svg>
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </th>
                  <th className="font-body font-medium border-l border-r uppercase p-2 px-2">
                    <div className="flex justify-center">Region</div>
                  </th>
                  <th className="font-body font-medium border-l border-r uppercase p-2 px-2">
                    <div className="flex justify-center">Sponsored</div>
                  </th>
                  <th className="font-body font-medium border-l border-r uppercase p-2 px-2">
                    <div className="flex justify-center">Indexed</div>
                  </th>
                  <th className="font-body font-medium border-l border-r uppercase p-2 px-2">
                    <div className="flex justify-center">
                      Do follow
                      {/* <button className="text-gray-500 ml-1 inline-flex items-center justify-center" data-state="closed">
                        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M0.877075 7.49972C0.877075 3.84204 3.84222 0.876892 7.49991 0.876892C11.1576 0.876892 14.1227 3.84204 14.1227 7.49972C14.1227 11.1574 11.1576 14.1226 7.49991 14.1226C3.84222 14.1226 0.877075 11.1574 0.877075 7.49972ZM7.49991 1.82689C4.36689 1.82689 1.82708 4.36671 1.82708 7.49972C1.82708 10.6327 4.36689 13.1726 7.49991 13.1726C10.6329 13.1726 13.1727 10.6327 13.1727 7.49972C13.1727 4.36671 10.6329 1.82689 7.49991 1.82689ZM8.24993 10.5C8.24993 10.9142 7.91414 11.25 7.49993 11.25C7.08571 11.25 6.74993 10.9142 6.74993 10.5C6.74993 10.0858 7.08571 9.75 7.49993 9.75C7.91414 9.75 8.24993 10.0858 8.24993 10.5ZM6.05003 6.25C6.05003 5.57211 6.63511 4.925 7.50003 4.925C8.36496 4.925 8.95003 5.57211 8.95003 6.25C8.95003 6.74118 8.68002 6.99212 8.21447 7.27494C8.16251 7.30651 8.10258 7.34131 8.03847 7.37854L8.03841 7.37858C7.85521 7.48497 7.63788 7.61119 7.47449 7.73849C7.23214 7.92732 6.95003 8.23198 6.95003 8.7C6.95004 9.00376 7.19628 9.25 7.50004 9.25C7.8024 9.25 8.04778 9.00601 8.05002 8.70417L8.05056 8.7033C8.05924 8.6896 8.08493 8.65735 8.15058 8.6062C8.25207 8.52712 8.36508 8.46163 8.51567 8.37436L8.51571 8.37433C8.59422 8.32883 8.68296 8.27741 8.78559 8.21506C9.32004 7.89038 10.05 7.35382 10.05 6.25C10.05 4.92789 8.93511 3.825 7.50003 3.825C6.06496 3.825 4.95003 4.92789 4.95003 6.25C4.95003 6.55376 5.19628 6.8 5.50003 6.8C5.80379 6.8 6.05003 6.55376 6.05003 6.25Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
                        </svg>
                      </button> */}
                    </div>
                  </th>
                  <th className="font-body font-medium border-l border-r uppercase p-2 px-2">
                    <div className="flex justify-center">Example</div>
                  </th>
                  <th className="font-body font-medium border-l border-r uppercase p-2 px-2">
                    <div className="flex justify-center">Niches</div>
                  </th>
                  {isAdmin && (
                    <th className="font-body font-medium border-l border-r uppercase p-2 px-2">
                      <div className="flex justify-center">Actions</div>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredData.map((item, index) => (
                  <tr key={index} className="text-sm">
                    <td className="py-2 px-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {item.image && (() => {
                            let imageUrl: string
                            
                            // Check if image is a JSON stringified logo object
                            if (typeof item.image === 'string') {
                              try {
                                const parsed = JSON.parse(item.image)
                                // If it's a logo object with Supabase metadata
                                if (parsed && parsed.asset?._metadata?.isSupabaseUpload && parsed.asset._metadata.storagePath) {
                                  // Extract Supabase URL
                                  const { data: { publicUrl } } = supabase.storage
                                    .from('publications')
                                    .getPublicUrl(parsed.asset._metadata.storagePath)
                                  imageUrl = publicUrl
                                } else if (parsed && parsed.asset?._ref) {
                                  // Legacy Sanity format - use Sanity CDN
                                  const ref = parsed.asset._ref.replace('image-', '')
                                  imageUrl = `https://cdn.sanity.io/images/8n90kyzz/production/${ref.replace(/-png$/, '.png').replace(/-jpg$/, '.jpg').replace(/-jpeg$/, '.jpeg').replace(/-webp$/, '.webp')}?w=80&h=80&fit=crop&auto=format&q=75`
                                } else {
                                  // Fallback to original string
                                  imageUrl = `https://pricing.ascendagency.com${item.image.replace(/&amp;/g, '&')}`
                                }
                              } catch (e) {
                                // Not JSON, treat as legacy string format
                                imageUrl = `https://pricing.ascendagency.com${item.image.replace(/&amp;/g, '&')}`
                              }
                            } else if (typeof item.image === 'object' && item.image !== null) {
                              // Already an object
                              const imageData = item.image as any
                              if (imageData.asset?._metadata?.isSupabaseUpload && imageData.asset._metadata.storagePath) {
                                // Supabase storage upload - construct URL dynamically
                                const { data: { publicUrl } } = supabase.storage
                                  .from('publications')
                                  .getPublicUrl(imageData.asset._metadata.storagePath)
                                imageUrl = publicUrl
                              } else if (imageData.asset?._ref) {
                                // Legacy Sanity format
                                const ref = imageData.asset._ref.replace('image-', '')
                                imageUrl = `https://cdn.sanity.io/images/8n90kyzz/production/${ref.replace(/-png$/, '.png').replace(/-jpg$/, '.jpg').replace(/-jpeg$/, '.jpeg').replace(/-webp$/, '.webp')}?w=80&h=80&fit=crop&auto=format&q=75`
                              } else {
                                // Fallback
                                imageUrl = `https://pricing.ascendagency.com${(item.image as any).toString().replace(/&amp;/g, '&')}`
                              }
                            } else {
                              // Legacy string format
                              imageUrl = `https://pricing.ascendagency.com${item.image.replace(/&amp;/g, '&')}`
                            }
                            
                            return (
                              <div className="inline-flex w-10 h-10">
                                <img
                                  alt={`${item.publication || 'Publication'} image`}
                                  src={imageUrl}
                                  className="w-10 h-10 object-cover rounded-full"
                                  loading="lazy"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement
                                    target.style.display = 'none'
                                  }}
                                />
                              </div>
                            )
                          })()}
                          <p>{item.publication || 'N/A'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-center border-l border-r">
                      {formatGenres(item.genres, index)}
                    </td>
                    <td className="text-center border-l border-r">{item.price || '-'}</td>
                    <td className="text-center border-l border-r">{item.da}</td>
                    <td className="text-center border-l border-r">{item.dr}</td>
                    <td className="text-center border-l border-r">{item.tat}</td>
                    <td className="text-center border-l border-r">
                      {formatRegions(item.region, index)}
                    </td>
                    <td className="text-center border-l border-r">{item.sponsored}</td>
                    <td className="text-center border-l border-r">{item.indexed}</td>
                    <td className="text-center border-l border-r">{item.dofollow}</td>
                    <td className="text-center border-l border-r relative">
                      {item.exampleUrl && (
                        <div
                          className="relative inline-block"
                          onMouseEnter={() => {
                            setHoveredIndex(index)
                            setHoveredColumn('example')
                          }}
                          onMouseLeave={() => {
                            setHoveredIndex(null)
                            setHoveredColumn(null)
                          }}
                        >
                          <a
                            href={item.exampleUrl}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                          >
                            <button className="inline-flex items-center justify-center" data-state="closed">
                              <svg
                                data-sanity-icon="images"
                                width="1em"
                                height="1em"
                                viewBox="0 0 25 25"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                style={{ fontSize: '20px' }}
                              >
                                <path
                                  d="M18.5 7.5H20.5V19.5H6.5V17.5M4.5 14.5L7.79289 11.2071C8.18342 10.8166 8.81658 10.8166 9.20711 11.2071L11.8867 13.8867C12.2386 14.2386 12.7957 14.2782 13.1938 13.9796L14.1192 13.2856C14.3601 13.1049 14.6696 13.0424 14.9618 13.1154L18.5 14M4.5 5.5H18.5V17.5H4.5V5.5ZM14.5 9.5C14.5 10.0523 14.0523 10.5 13.5 10.5C12.9477 10.5 12.5 10.0523 12.5 9.5C12.5 8.94772 12.9477 8.5 13.5 8.5C14.0523 8.5 14.5 8.94772 14.5 9.5Z"
                                  stroke="currentColor"
                                  strokeWidth="1.2"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                          </a>
                          {hoveredIndex === index && hoveredColumn === 'example' && (
                            <div 
                              data-radix-popper-content-wrapper=""
                              className="absolute z-50 left-1/2 transform -translate-x-1/2 bottom-full mb-2"
                              style={{
                                minWidth: 'max-content',
                                willChange: 'transform'
                              }}
                              onMouseEnter={(e: React.MouseEvent) => {
                                e.stopPropagation()
                                setHoveredIndex(index)
                                setHoveredColumn('example')
                              }}
                              onMouseLeave={(e: React.MouseEvent) => {
                                e.stopPropagation()
                                setHoveredIndex(null)
                                setHoveredColumn(null)
                              }}
                            >
                              <div 
                                data-side="top" 
                                data-align="center" 
                                data-state="instant-open" 
                                className="select-none rounded-[4px] bg-white px-[15px] py-[10px] text-[15px] leading-none shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,_hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px] will-change-[transform,opacity] border-2 pointer-events-auto"
                              >
                                <div className="overflow-hidden max-h-80">
                                  <p className="font-body font-bold mb-2">Click to open full image</p>
                                  {item.exampleUrl ? (
                                    <img 
                                      alt={`${item.publication} preview`}
                                      loading="lazy"
                                      width="250"
                                      height="200"
                                      decoding="async"
                                      fetchPriority="low"
                                      className="object-cover border"
                                      src={item.exampleUrl.includes('?') ? `${item.exampleUrl}&w=250&h=200&fit=crop&auto=format&q=80` : `${item.exampleUrl}?w=250&h=200&fit=crop&auto=format&q=80`}
                                      onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                                        e.currentTarget.style.display = 'none'
                                      }}
                                    />
                                  ) : (
                                    <div className="w-[250px] h-[200px] flex items-center justify-center border bg-gray-100">
                                      <p className="text-sm text-gray-500">No preview available</p>
                                    </div>
                                  )}
                                </div>
                                <span style={{ position: 'absolute', bottom: '0px', transform: 'translateY(100%)', left: '50%', marginLeft: '-5px' }}>
                                  <svg className="fill-white" width="10" height="5" viewBox="0 0 30 10" preserveAspectRatio="none" style={{ display: 'block' }}>
                                    <polygon points="0,0 30,0 15,10"></polygon>
                                  </svg>
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="text-center border-l border-r min-w-[120px] relative">
                      <div className="flex justify-between px-[4px]">
                        {(() => {
                          const nicheIcons = [
                            { name: 'Erotic', displayName: 'erotic', icon: 'erotic' },
                            { name: 'Health', displayName: 'health content', icon: 'health' },
                            { name: 'CBD', displayName: 'Cbd content', icon: 'cbd' },
                            { name: 'Crypto', displayName: 'Crypto content', icon: 'crypto' },
                            { name: 'Gambling', displayName: 'Gambling content', icon: 'gambling' }
                          ]
                          const nicheData = parseNiches(item.niches)
                          
                          return nicheIcons.map((iconInfo, iconIndex) => {
                            const niche = nicheData.find(n => n.name === iconInfo.name)
                            const isHovered = hoveredNicheIcon?.index === index && hoveredNicheIcon?.niche === iconInfo.name
                            
                            return (
                              <div key={iconIndex} className="relative">
                                <div className="w-[24px] h-[24px] mx-auto">
                                  <button 
                                    className="inline-flex items-center justify-center" 
                                    data-state="closed"
                                    style={{
                                      color: niche && niche.accepted ? 'currentColor' : '#9ca3af'
                                    }}
                                    onMouseEnter={() => {
                                      setHoveredNicheIcon({ index, niche: iconInfo.name })
                                    }}
                                    onMouseLeave={() => {
                                      setHoveredNicheIcon(null)
                                    }}
                                  >
                                    {iconIndex === 0 && (
                                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" className="cursor-pointer">
                                        <path fill="currentColor" d="M16.91 6.275h.817v.818a.818.818 0 1 0 1.637 0v-.818h.818a.818.818 0 1 0 0-1.636h-.818V3.82a.818.818 0 0 0-1.637 0v.819h-.818a.818.818 0 0 0 0 1.636m-9 1.636v8.182a.818.818 0 1 0 1.635 0V7.911a.818.818 0 1 0-1.636 0m11.945 1.637a.82.82 0 0 0-.639.965 7.363 7.363 0 1 1-5.727-5.727.834.834 0 1 0 .327-1.637A9 9 0 0 0 12 3.002a9 9 0 1 0 8.82 7.2.82.82 0 0 0-.965-.654m-8.673 0v.818c.003.605.23 1.188.638 1.636a2.46 2.46 0 0 0-.638 1.637v.818a2.455 2.455 0 0 0 2.454 2.454h.819a2.454 2.454 0 0 0 2.454-2.454v-.818a2.46 2.46 0 0 0-.638-1.637c.407-.448.634-1.03.638-1.636v-.818a2.454 2.454 0 0 0-2.454-2.455h-.819a2.455 2.455 0 0 0-2.454 2.455m4.09 4.909a.82.82 0 0 1-.818.818h-.818a.82.82 0 0 1-.818-.818v-.818a.82.82 0 0 1 .818-.819h.819a.82.82 0 0 1 .818.819zm0-4.91v.819a.82.82 0 0 1-.818.818h-.818a.82.82 0 0 1-.818-.818v-.818a.82.82 0 0 1 .818-.819h.819a.82.82 0 0 1 .818.819"></path>
                                      </svg>
                                    )}
                                    {iconIndex === 1 && (
                                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="w-[23px] cursor-pointer" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 0 0 0 6.364L12 20.364l7.682-7.682a4.5 4.5 0 0 0-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 0 0-6.364 0"></path>
                                      </svg>
                                    )}
                                    {iconIndex === 2 && (
                                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" className="cursor-pointer">
                                        <path fill="currentColor" d="M20.103 14.326a9 9 0 0 0-.9-.363c1.29-1.906 1.729-3.67 1.753-3.77a1.58 1.58 0 0 0-.406-1.474 1.6 1.6 0 0 0-1.47-.452c-.103.02-1.838.383-3.785 1.438-.479-2.839-1.906-4.917-1.978-5.02a1.606 1.606 0 0 0-2.634 0c-.072.104-1.499 2.181-1.978 5.02C6.758 8.65 5.023 8.289 4.921 8.268a1.61 1.61 0 0 0-1.47.453c-.381.39-.534.945-.407 1.473.024.1.463 1.864 1.753 3.77a9 9 0 0 0-.9.363c-.548.266-.897.82-.897 1.426s.347 1.16.895 1.427c.072.035 1.532.736 3.49.948a1.58 1.58 0 0 0 .433 1.263 1.61 1.61 0 0 0 1.602.43c.122-.035.855-.257 1.786-.737v1.329c0 .292.237.53.53.53h.529a.53.53 0 0 0 .53-.53v-1.329c.93.48 1.663.702 1.784.737q.221.063.444.062c.432 0 .853-.173 1.159-.492.328-.342.482-.805.433-1.263 1.958-.213 3.418-.913 3.49-.948.548-.267.895-.82.895-1.427 0-.606-.349-1.16-.897-1.426M15.515 16.6c-.573 0-1.03-.029-1.404-.077l-.02.009c.654.953.932 1.762.932 1.762S13.435 17.84 12 16.69c-1.435 1.15-3.023 1.604-3.023 1.604s.279-.809.932-1.762q-.01-.004-.02-.01c-.374.05-.831.078-1.404.078-2.145 0-3.884-.847-3.884-.847s1.352-.656 3.142-.813c-.028-.025-.052-.043-.08-.069C5.295 12.703 4.6 9.824 4.6 9.824s3.144.636 5.511 2.804c.031.028.052.052.082.08a15 15 0 0 1-.044-1.19c0-3.275 1.85-5.93 1.85-5.93s1.85 2.655 1.85 5.93q-.001.653-.044 1.19c.03-.028.05-.052.082-.08 2.367-2.168 5.511-2.804 5.511-2.804s-.694 2.879-3.062 5.047c-.028.026-.052.044-.08.07 1.79.155 3.142.812 3.142.812s-1.739.847-3.884.847"></path>
                                      </svg>
                                    )}
                                    {iconIndex === 3 && (
                                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" className="cursor-pointer">
                                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.142 7.903v-1m0 9.194v1M14.444 9C12 7.5 8.5 8 8.5 12s3.5 4.097 5.944 3m-4.302-6.5V6.903m0 8.194V17M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0"></path>
                                      </svg>
                                    )}
                                    {iconIndex === 4 && (
                                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" className="cursor-pointer">
                                        <path fill="currentColor" d="M16.5 3h-9A4.5 4.5 0 0 0 3 7.5v9A4.5 4.5 0 0 0 7.5 21h9a4.5 4.5 0 0 0 4.5-4.5v-9A4.5 4.5 0 0 0 16.5 3m2.7 13.5a2.7 2.7 0 0 1-2.7 2.7h-9a2.7 2.7 0 0 1-2.7-2.7v-9a2.7 2.7 0 0 1 2.7-2.7h9a2.7 2.7 0 0 1 2.7 2.7zM8.4 14.7a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8m3.6-3.6a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8M8.4 7.5a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8m7.2 7.2a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8m0-7.2a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8"></path>
                                      </svg>
                                    )}
                                  </button>
                                </div>
                                {isHovered && niche && (
                                  <div 
                                    data-radix-popper-content-wrapper=""
                                    className="absolute z-[9999] left-1/2 transform -translate-x-1/2 bottom-full mb-2"
                                    style={{
                                      minWidth: 'max-content',
                                      willChange: 'transform',
                                      position: 'absolute',
                                      pointerEvents: 'auto'
                                    }}
                                    onMouseEnter={(e: React.MouseEvent) => {
                                      e.stopPropagation()
                                      setHoveredNicheIcon({ index, niche: iconInfo.name })
                                    }}
                                    onMouseLeave={(e: React.MouseEvent) => {
                                      e.stopPropagation()
                                      setHoveredNicheIcon(null)
                                    }}
                                  >
                                    <div 
                                      data-side="top" 
                                      data-align="center" 
                                      data-state="instant-open" 
                                      className="select-none rounded-[4px] bg-white px-[15px] py-[10px] text-[15px] leading-none shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,_hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px] will-change-[transform,opacity] border-2 pointer-events-auto whitespace-nowrap"
                                    >
                                      {niche.accepted && niche.price ? (
                                        <span className="text-sm">{niche.displayName} price: {niche.price}</span>
                                      ) : (
                                        <span className="text-sm">The media doesn&apos;t accept {niche.displayName}</span>
                                      )}
                                      <span style={{ position: 'absolute', bottom: '0px', transform: 'translateY(100%)', left: '50%', marginLeft: '-5px' }}>
                                        <svg className="fill-white" width="10" height="5" viewBox="0 0 30 10" preserveAspectRatio="none" style={{ display: 'block' }}>
                                          <polygon points="0,0 30,0 15,10"></polygon>
                                        </svg>
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })
                        })()}
                      </div>
                    </td>
                    {isAdmin && (
                      <td className="text-center border-l border-r">
                        <div className="flex items-center justify-center gap-3">
                          <button
                            onClick={() => {
                              setEditingRecord(item)
                              setShowAddModal(true)
                            }}
                            className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                            title="Edit"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => {
                              if (item.id) {
                                handleDeleteRecord(item.id)
                              } else {
                                console.error('❌ Best seller missing ID:', item)
                                setError('Cannot delete: Record ID is missing')
                              }
                            }}
                            className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[80px]"
                            disabled={!item.id || deletingRecordId === item.id}
                          >
                            {deletingRecordId === item.id ? (
                              <>
                                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span>Removing...</span>
                              </>
                            ) : (
                              'Remove'
                            )}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showAddModal && (
        <AddBestSellerForm
          onClose={() => {
            setShowAddModal(false)
            setEditingRecord(null)
          }}
          onSubmit={editingRecord ? handleUpdateRecord : handleCreateRecord}
          error={error}
          success={success}
          initialData={editingRecord || undefined}
          isEditMode={!!editingRecord}
        />
      )}
    </div>
  )
}

