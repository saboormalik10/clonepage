'use client'

import { useState, useEffect, useCallback } from 'react'
import { useUserId } from '@/hooks/useUserId'
import { useIsAdmin } from '@/hooks/useIsAdmin'
import { useVisibilityChange } from '@/hooks/useVisibilityChange'
import { createClient } from '@/lib/supabase-client'
import { isPriceAdjusted, getAdjustmentInfo, hasActiveAdjustments } from '@/lib/price-adjustment-utils'
import AddListicleForm from './AddListicleForm'

interface Listicle {
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
}

export default function ListiclesTab() {
  const [listiclesData, setListiclesData] = useState<Listicle[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredData, setFilteredData] = useState<Listicle[]>([])
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [hoveredColumn, setHoveredColumn] = useState<'example' | 'genres' | 'regions' | null>(null)
  const [priceAdjustments, setPriceAdjustments] = useState<any>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingRecord, setEditingRecord] = useState<Listicle | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null)

  const userId = useUserId()
  const isAdmin = useIsAdmin()
  const { refreshTrigger } = useVisibilityChange()
  const supabase = createClient()

  // Refetch listicles data (reusable function)
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true)
      console.log('🔍 [Listicles] Starting fetch...')
      const { authenticatedFetch } = await import('@/lib/authenticated-fetch')
      const response = await authenticatedFetch('/api/listicles')
      
      console.log('📡 [Listicles] Response status:', response.status, response.ok)
      
      if (!response.ok) {
        let errorData
        try {
          errorData = await response.json()
        } catch (e) {
          errorData = { error: `HTTP ${response.status}: ${response.statusText || 'Unknown error'}` }
        }
        console.error('❌ [Listicles] API error:', response.status, errorData)
        if (response.status === 401) {
          console.error('❌ [Listicles] Authentication failed - redirecting to login')
          window.location.href = '/login'
          return
        }
        throw new Error(`API error: ${response.status} - ${errorData.error || 'Unknown error'}`)
      }
      
      const responseData = await response.json()
      console.log('✅ [Listicles] Data received:', responseData)
      
      // Handle new response format with data and priceAdjustments
      let data = responseData
      if (responseData && typeof responseData === 'object' && 'data' in responseData) {
        data = responseData.data
        setPriceAdjustments(responseData.priceAdjustments)
      }
      
      if (Array.isArray(data)) {
        setListiclesData(data)
        setFilteredData(data)
      } else {
        console.warn('⚠️ [Listicles] Unexpected data format:', data)
        setListiclesData([])
        setFilteredData([])
      }
    } catch (error: any) {
      console.error('❌ [Listicles] Error fetching data:', error)
      console.error('   Error details:', error.message)
      setListiclesData([])
      setFilteredData([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch listicles data from API on mount and when tab becomes visible
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

  // Transform API response (snake_case) to Listicle format (camelCase)
  const transformApiRecordToListicle = (apiRecord: any): Listicle => {
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
    }
  }

  const handleCreateRecord = useCallback(async (formData: any) => {
    setError('')
    setSuccess('')

    try {
      // Transform data from publications-style form to listicles table schema
      // Convert arrays to comma-separated strings for listicles table
      const genresString = formData.genres && formData.genres.length > 0
        ? formData.genres.map((g: any) => g.name).filter(Boolean).join(', ')
        : null

      const regionsString = formData.regions && formData.regions.length > 0
        ? formData.regions.map((r: any) => r.name).filter(Boolean).join(', ')
        : null

      // Price is already in listicle format (text string)
      const priceString = formData.price || null

      // Use logo as image
      const imageValue = formData.logo || null

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
      
      const response = await fetch('/api/admin/records/listicles', {
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

      // Transform API response to Listicle format and add to state
      const newListicle = transformApiRecordToListicle(data.record)
      
      // Add new record to listiclesData
      setListiclesData(prev => [...prev, newListicle])
      
      // Update filtered data if it matches the search term
      const term = searchTerm.toLowerCase()
      if (!term || 
          newListicle.publication.toLowerCase().includes(term) ||
          newListicle.genres.toLowerCase().includes(term) ||
          newListicle.region.toLowerCase().includes(term)) {
        setFilteredData(prev => [...prev, newListicle])
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
      // Transform data from publications-style form to listicles table schema
      const genresString = formData.genres && formData.genres.length > 0
        ? formData.genres.map((g: any) => g.name).filter(Boolean).join(', ')
        : null

      const regionsString = formData.regions && formData.regions.length > 0
        ? formData.regions.map((r: any) => r.name).filter(Boolean).join(', ')
        : null

      const priceString = formData.price || null
      const imageValue = formData.logo || null

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

      const response = await fetch(`/api/admin/records/listicles?id=${editingRecord.id}`, {
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

      // Transform API response to Listicle format and update state
      const updatedListicle = transformApiRecordToListicle(data.record)
      
      // Update record in listiclesData
      setListiclesData(prev => prev.map(item => 
        item.id === editingRecord.id ? updatedListicle : item
      ))
      
      // Update filtered data as well
      setFilteredData(prev => prev.map(item => 
        item.id === editingRecord.id ? updatedListicle : item
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
      
      console.log('🗑️ Deleting listicle with ID:', recordId)
      const token = getAuthToken()
      const response = await fetch(`/api/admin/records/listicles?id=${recordId}`, {
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
      setListiclesData(prev => prev.filter(item => item.id !== recordId))
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
    const filtered = listiclesData.filter(
      (listicle) =>
        listicle.publication.toLowerCase().includes(term) ||
        listicle.genres.toLowerCase().includes(term) ||
        listicle.region.toLowerCase().includes(term)
    )
    setFilteredData(filtered)
  }

  const formatPrice = (priceString: string) => {
    if (!priceString) return null
    
    // Match pattern: "Top X : $Y" or "TopX: $Y" where X is a number and Y is a price
    // Handle multiple formats:
    // - "Top 5 : $2,750 Top 10 : $4,000" (with spaces everywhere)
    // - "Top 5 : $2,750Top 10 : $4,000" (no space between entries)
    // - "Top5: $600 Top 10: $980" (no space after "Top", no space after colon)
    // - "Top 10: $25,000Top 5: $20,000" (spaces after "Top" but no space after colon, no space between entries)
    // The regex uses \s* to handle optional spaces everywhere
    const regex = /Top\s*(\d+)\s*:\s*(\$[\d,]+)/g
    const matches: Array<{ top: string; price: string }> = []
    
    // Reset regex lastIndex to ensure we start from the beginning
    regex.lastIndex = 0
    
    let match
    while ((match = regex.exec(priceString)) !== null) {
      matches.push({
        top: `Top ${match[1]}`,
        price: match[2]
      })
    }
    
    if (matches.length === 0) {
      // If no matches found, return the original string
      return <span>{priceString}</span>
    }
    
    return (
      <div className="flex flex-col">
        {matches.map((item, index) => (
          <div key={index} className="text-left">
            <span className="text-gray-500">{item.top} : </span>
            <span className="text-black">{item.price}</span>
          </div>
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

  if (isLoading) {
    return (
      <div className="opacity-100">
        <div className="flex items-center justify-center p-8">
          <p className="text-gray-500">Loading listicles...</p>
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
              SHOWING {filteredData.length} OF {listiclesData.length} PUBLICATIONS
            </p>
            {isAdmin && (
              <button
                onClick={() => {
                  setEditingRecord(null)
                  setShowAddModal(true)
                }}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Add Listicle
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
                      {hasActiveAdjustments(priceAdjustments) && (
                        <span className="text-xs font-normal text-blue-600 mt-1" title={getAdjustmentInfo(priceAdjustments)}>
                          (Adjusted)
                        </span>
                      )}
                    </div>
                  </th>
                  <th className="font-body font-medium border-l border-r uppercase p-2 px-2">
                    <div className="flex justify-center">
                      DA
                      <button className="text-gray-500 ml-1 inline-flex items-center justify-center" data-state="closed">
                        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M0.877075 7.49972C0.877075 3.84204 3.84222 0.876892 7.49991 0.876892C11.1576 0.876892 14.1227 3.84204 14.1227 7.49972C14.1227 11.1574 11.1576 14.1226 7.49991 14.1226C3.84222 14.1226 0.877075 11.1574 0.877075 7.49972ZM7.49991 1.82689C4.36689 1.82689 1.82708 4.36671 1.82708 7.49972C1.82708 10.6327 4.36689 13.1726 7.49991 13.1726C10.6329 13.1726 13.1727 10.6327 13.1727 7.49972C13.1727 4.36671 10.6329 1.82689 7.49991 1.82689ZM8.24993 10.5C8.24993 10.9142 7.91414 11.25 7.49993 11.25C7.08571 11.25 6.74993 10.9142 6.74993 10.5C6.74993 10.0858 7.08571 9.75 7.49993 9.75C7.91414 9.75 8.24993 10.0858 8.24993 10.5ZM6.05003 6.25C6.05003 5.57211 6.63511 4.925 7.50003 4.925C8.36496 4.925 8.95003 5.57211 8.95003 6.25C8.95003 6.74118 8.68002 6.99212 8.21447 7.27494C8.16251 7.30651 8.10258 7.34131 8.03847 7.37854L8.03841 7.37858C7.85521 7.48497 7.63788 7.61119 7.47449 7.73849C7.23214 7.92732 6.95003 8.23198 6.95003 8.7C6.95004 9.00376 7.19628 9.25 7.50004 9.25C7.8024 9.25 8.04778 9.00601 8.05002 8.70417L8.05056 8.7033C8.05924 8.6896 8.08493 8.65735 8.15058 8.6062C8.25207 8.52712 8.36508 8.46163 8.51567 8.37436L8.51571 8.37433C8.59422 8.32883 8.68296 8.27741 8.78559 8.21506C9.32004 7.89038 10.05 7.35382 10.05 6.25C10.05 4.92789 8.93511 3.825 7.50003 3.825C6.06496 3.825 4.95003 4.92789 4.95003 6.25C4.95003 6.55376 5.19628 6.8 5.50003 6.8C5.80379 6.8 6.05003 6.55376 6.05003 6.25Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </th>
                  <th className="font-body font-medium border-l border-r uppercase p-2 px-2">
                    <div className="flex justify-center">
                      DR
                      <button className="text-gray-500 ml-1 inline-flex items-center justify-center" data-state="closed">
                        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M0.877075 7.49972C0.877075 3.84204 3.84222 0.876892 7.49991 0.876892C11.1576 0.876892 14.1227 3.84204 14.1227 7.49972C14.1227 11.1574 11.1576 14.1226 7.49991 14.1226C3.84222 14.1226 0.877075 11.1574 0.877075 7.49972ZM7.49991 1.82689C4.36689 1.82689 1.82708 4.36671 1.82708 7.49972C1.82708 10.6327 4.36689 13.1726 7.49991 13.1726C10.6329 13.1726 13.1727 10.6327 13.1727 7.49972C13.1727 4.36671 10.6329 1.82689 7.49991 1.82689ZM8.24993 10.5C8.24993 10.9142 7.91414 11.25 7.49993 11.25C7.08571 11.25 6.74993 10.9142 6.74993 10.5C6.74993 10.0858 7.08571 9.75 7.49993 9.75C7.91414 9.75 8.24993 10.0858 8.24993 10.5ZM6.05003 6.25C6.05003 5.57211 6.63511 4.925 7.50003 4.925C8.36496 4.925 8.95003 5.57211 8.95003 6.25C8.95003 6.74118 8.68002 6.99212 8.21447 7.27494C8.16251 7.30651 8.10258 7.34131 8.03847 7.37854L8.03841 7.37858C7.85521 7.48497 7.63788 7.61119 7.47449 7.73849C7.23214 7.92732 6.95003 8.23198 6.95003 8.7C6.95004 9.00376 7.19628 9.25 7.50004 9.25C7.8024 9.25 8.04778 9.00601 8.05002 8.70417L8.05056 8.7033C8.05924 8.6896 8.08493 8.65735 8.15058 8.6062C8.25207 8.52712 8.36508 8.46163 8.51567 8.37436L8.51571 8.37433C8.59422 8.32883 8.68296 8.27741 8.78559 8.21506C9.32004 7.89038 10.05 7.35382 10.05 6.25C10.05 4.92789 8.93511 3.825 7.50003 3.825C6.06496 3.825 4.95003 4.92789 4.95003 6.25C4.95003 6.55376 5.19628 6.8 5.50003 6.8C5.80379 6.8 6.05003 6.55376 6.05003 6.25Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </th>
                  <th className="font-body font-medium border-l border-r uppercase p-2 px-2">
                    <div className="flex justify-center">
                      TAT
                      <button className="text-gray-500 ml-1 inline-flex items-center justify-center" data-state="closed">
                        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M0.877075 7.49972C0.877075 3.84204 3.84222 0.876892 7.49991 0.876892C11.1576 0.876892 14.1227 3.84204 14.1227 7.49972C14.1227 11.1574 11.1576 14.1226 7.49991 14.1226C3.84222 14.1226 0.877075 11.1574 0.877075 7.49972ZM7.49991 1.82689C4.36689 1.82689 1.82708 4.36671 1.82708 7.49972C1.82708 10.6327 4.36689 13.1726 7.49991 13.1726C10.6329 13.1726 13.1727 10.6327 13.1727 7.49972C13.1727 4.36671 10.6329 1.82689 7.49991 1.82689ZM8.24993 10.5C8.24993 10.9142 7.91414 11.25 7.49993 11.25C7.08571 11.25 6.74993 10.9142 6.74993 10.5C6.74993 10.0858 7.08571 9.75 7.49993 9.75C7.91414 9.75 8.24993 10.0858 8.24993 10.5ZM6.05003 6.25C6.05003 5.57211 6.63511 4.925 7.50003 4.925C8.36496 4.925 8.95003 5.57211 8.95003 6.25C8.95003 6.74118 8.68002 6.99212 8.21447 7.27494C8.16251 7.30651 8.10258 7.34131 8.03847 7.37854L8.03841 7.37858C7.85521 7.48497 7.63788 7.61119 7.47449 7.73849C7.23214 7.92732 6.95003 8.23198 6.95003 8.7C6.95004 9.00376 7.19628 9.25 7.50004 9.25C7.8024 9.25 8.04778 9.00601 8.05002 8.70417L8.05056 8.7033C8.05924 8.6896 8.08493 8.65735 8.15058 8.6062C8.25207 8.52712 8.36508 8.46163 8.51567 8.37436L8.51571 8.37433C8.59422 8.32883 8.68296 8.27741 8.78559 8.21506C9.32004 7.89038 10.05 7.35382 10.05 6.25C10.05 4.92789 8.93511 3.825 7.50003 3.825C6.06496 3.825 4.95003 4.92789 4.95003 6.25C4.95003 6.55376 5.19628 6.8 5.50003 6.8C5.80379 6.8 6.05003 6.55376 6.05003 6.25Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
                        </svg>
                      </button>
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
                      <button className="text-gray-500 ml-1 inline-flex items-center justify-center" data-state="closed">
                        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M0.877075 7.49972C0.877075 3.84204 3.84222 0.876892 7.49991 0.876892C11.1576 0.876892 14.1227 3.84204 14.1227 7.49972C14.1227 11.1574 11.1576 14.1226 7.49991 14.1226C3.84222 14.1226 0.877075 11.1574 0.877075 7.49972ZM7.49991 1.82689C4.36689 1.82689 1.82708 4.36671 1.82708 7.49972C1.82708 10.6327 4.36689 13.1726 7.49991 13.1726C10.6329 13.1726 13.1727 10.6327 13.1727 7.49972C13.1727 4.36671 10.6329 1.82689 7.49991 1.82689ZM8.24993 10.5C8.24993 10.9142 7.91414 11.25 7.49993 11.25C7.08571 11.25 6.74993 10.9142 6.74993 10.5C6.74993 10.0858 7.08571 9.75 7.49993 9.75C7.91414 9.75 8.24993 10.0858 8.24993 10.5ZM6.05003 6.25C6.05003 5.57211 6.63511 4.925 7.50003 4.925C8.36496 4.925 8.95003 5.57211 8.95003 6.25C8.95003 6.74118 8.68002 6.99212 8.21447 7.27494C8.16251 7.30651 8.10258 7.34131 8.03847 7.37854L8.03841 7.37858C7.85521 7.48497 7.63788 7.61119 7.47449 7.73849C7.23214 7.92732 6.95003 8.23198 6.95003 8.7C6.95004 9.00376 7.19628 9.25 7.50004 9.25C7.8024 9.25 8.04778 9.00601 8.05002 8.70417L8.05056 8.7033C8.05924 8.6896 8.08493 8.65735 8.15058 8.6062C8.25207 8.52712 8.36508 8.46163 8.51567 8.37436L8.51571 8.37433C8.59422 8.32883 8.68296 8.27741 8.78559 8.21506C9.32004 7.89038 10.05 7.35382 10.05 6.25C10.05 4.92789 8.93511 3.825 7.50003 3.825C6.06496 3.825 4.95003 4.92789 4.95003 6.25C4.95003 6.55376 5.19628 6.8 5.50003 6.8C5.80379 6.8 6.05003 6.55376 6.05003 6.25Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </th>
                  <th className="font-body font-medium border-l border-r uppercase p-2 px-2">
                    <div className="flex justify-center">Example</div>
                  </th>
                  {isAdmin && (
                    <th className="font-body font-medium border-l border-r uppercase p-2 px-2">
                      <div className="flex justify-center">Actions</div>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredData.map((listicle, index) => (
                  <tr key={index} className="text-sm">
                    <td className="py-2 px-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {listicle.image && (() => {
                            let imageUrl: string
                            
                            // Check if image is a JSON stringified logo object
                            if (typeof listicle.image === 'string') {
                              try {
                                const parsed = JSON.parse(listicle.image)
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
                                  imageUrl = `https://pricing.ascendagency.com${listicle.image.replace(/&amp;/g, '&')}`
                                }
                              } catch (e) {
                                // Not JSON, treat as legacy string format
                                imageUrl = `https://pricing.ascendagency.com${listicle.image.replace(/&amp;/g, '&')}`
                              }
                            } else if (typeof listicle.image === 'object' && listicle.image !== null) {
                              // Already an object
                              const imageData = listicle.image as any
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
                                imageUrl = `https://pricing.ascendagency.com${(listicle.image as any).toString().replace(/&amp;/g, '&')}`
                              }
                            } else {
                              // Legacy string format
                              imageUrl = `https://pricing.ascendagency.com${listicle.image.replace(/&amp;/g, '&')}`
                            }
                            
                            return (
                              <div className="inline-flex w-10 h-10">
                                <img
                                  alt={`${listicle.publication || 'Publication'} image`}
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
                          <p>{listicle.publication || 'N/A'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-center border-l border-r">
                      {formatGenres(listicle.genres, index)}
                    </td>
                    <td className="text-center border-l border-r">
                      {formatPrice(listicle.price)}
                    </td>
                    <td className="text-center border-l border-r">{listicle.da}</td>
                    <td className="text-center border-l border-r">{listicle.dr}</td>
                    <td className="text-center border-l border-r">{listicle.tat}</td>
                    <td className="text-center border-l border-r">{formatRegions(listicle.region, index)}</td>
                    <td className="text-center border-l border-r">{listicle.sponsored}</td>
                    <td className="text-center border-l border-r">{listicle.indexed}</td>
                    <td className="text-center border-l border-r">{listicle.dofollow}</td>
                    <td className="text-center border-l border-r relative">
                      {listicle.exampleUrl && listicle.exampleUrl !== '' && (
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
                            href={listicle.exampleUrl}
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
                                  {listicle.exampleUrl ? (
                                    <img 
                                      alt={`${listicle.publication} preview`}
                                      loading="lazy"
                                      width="250"
                                      height="200"
                                      decoding="async"
                                      fetchPriority="low"
                                      className="object-cover border"
                                      src={listicle.exampleUrl.includes('?') ? `${listicle.exampleUrl}&w=250&h=200&fit=crop&auto=format&q=80` : `${listicle.exampleUrl}?w=250&h=200&fit=crop&auto=format&q=80`}
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
                    {isAdmin && (
                      <td className="text-center border-l border-r">
                        <div className="flex items-center justify-center gap-3">
                          <button
                            onClick={() => {
                              setEditingRecord(listicle)
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
                              if (listicle.id) {
                                handleDeleteRecord(listicle.id)
                              } else {
                                console.error('❌ Listicle missing ID:', listicle)
                                setError('Cannot delete: Record ID is missing')
                              }
                            }}
                            className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[80px]"
                            disabled={!listicle.id || deletingRecordId === listicle.id}
                          >
                            {deletingRecordId === listicle.id ? (
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
        <AddListicleForm
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

