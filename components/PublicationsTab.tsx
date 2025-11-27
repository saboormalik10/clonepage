'use client'

import { useState, useEffect, useRef, useCallback, useTransition, useMemo } from 'react'
import { useUserId } from '@/hooks/useUserId'
import { useIsAdmin } from '@/hooks/useIsAdmin'
import { useVisibilityChange } from '@/hooks/useVisibilityChange'
import { createClient } from '@/lib/supabase-client'
import AddPublicationForm from './AddPublicationForm'

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

interface Genre {
  name: string
  description: string | null
  slug: string
}

interface Region {
  name: string
  description: string | null
  slug: string
}

interface Publication {
  _id: string
  name: string
  logo: {
    _type: string
    asset: {
      _ref: string
      _type: string
    }
  } | null
  genres: Genre[]
  defaultPrice: number[]
  customPrice: number[]
  domain_authority: number | null
  domain_rating: number | null
  estimated_time: string | null
  regions: Region[]
  sponsored: string | null
  indexed: string | null
  do_follow: string | null
  articlePreview: {
    _type: string
    asset: {
      _ref: string
      _type: string
    }
  } | null
  image: string | null
  img_explain: string | null
  url: string | null
  health: boolean | null
  healthMultiplier: string | null
  cbd: boolean | null
  cbdMultiplier: string | null
  crypto: boolean | null
  cryptoMultiplier: string | null
  gambling: boolean | null
  gamblingMultiplier: string | null
  erotic: boolean | null
  eroticMultiplier: string | null
  eroticPrice: number | null
}

const genres = ['News', 'Lifestyle', 'Entertainment', 'Business', 'Tech', 'Music', 'Web 3', 'Luxury', 'Fashion', 'Real Estate', 'Sports', 'Gaming', 'Political', 'Legal', 'Alcohol']

const types = ['Staff', 'New', 'Updated', 'Press Release', 'Contributor', 'Lowered', '6 Month Lifespan', 'On Hold', 'Raised', 'Includes Social Posts', 'Guaranteed Impressions']

const niches = ['Health', 'Crypto', 'Cbd', 'Gambling', 'Erotic']


export default function PublicationsTab() {
  const [publicationsData, setPublicationsData] = useState<Publication[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  // Debounce search input - only apply filter after user stops typing for 300ms
  // This ensures smooth typing without lag
  const debouncedSearchTerm = useDebounce(searchInput, 300)
  const [isPending, startTransition] = useTransition()
  const [priceRange, setPriceRange] = useState([0, 0])
  const [sortBy, setSortBy] = useState('Price (Asc)')
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [selectedSponsored, setSelectedSponsored] = useState<string>('')
  const [selectedDofollow, setSelectedDofollow] = useState<string>('')
  const [selectedIndexed, setSelectedIndexed] = useState<string>('')
  const [selectedImage, setSelectedImage] = useState<string>('')
  const [selectedNiches, setSelectedNiches] = useState<string[]>([])
  const [filteredData, setFilteredData] = useState<Publication[]>([])
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [hoveredColumn, setHoveredColumn] = useState<'example' | 'image' | 'genres' | 'regions' | 'niches' | null>(null)
  const [hoveredNicheIcon, setHoveredNicheIcon] = useState<{index: number, niche: string} | null>(null)
  const [hoveredHeaderTooltip, setHoveredHeaderTooltip] = useState<'da' | 'dr' | 'tat' | null>(null)
  const minRangeRef = useRef<HTMLInputElement>(null)
  const maxRangeRef = useRef<HTMLInputElement>(null)
  const isAdmin = useIsAdmin()
  const [showAddModal, setShowAddModal] = useState(false)
  const hasFetchedRef = useRef(false)
  const lastRefreshTriggerRef = useRef(0)
  const [editingRecord, setEditingRecord] = useState<Publication | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null)
  const supabase = createClient()

  const getPrice = (pub: Publication): number => {
    if (pub.customPrice && pub.customPrice.length > 0) {
      return pub.customPrice[0]
    }
    if (pub.defaultPrice && pub.defaultPrice.length > 0) {
      return pub.defaultPrice[0]
    }
    return 0
  }

  // Transform API response (snake_case) to Publication format (camelCase)
  const transformApiRecordToPublication = (apiRecord: any): Publication => {
    return {
      _id: apiRecord._id,
      name: apiRecord.name,
      logo: apiRecord.logo,
      genres: apiRecord.genres || [],
      defaultPrice: apiRecord.default_price || [],
      customPrice: apiRecord.custom_price || [],
      domain_authority: apiRecord.domain_authority,
      domain_rating: apiRecord.domain_rating,
      estimated_time: apiRecord.estimated_time,
      regions: apiRecord.regions || [],
      sponsored: apiRecord.sponsored,
      indexed: apiRecord.indexed,
      do_follow: apiRecord.do_follow,
      articlePreview: apiRecord.article_preview,
      image: apiRecord.image,
      img_explain: apiRecord.img_explain,
      url: apiRecord.url,
      health: apiRecord.health,
      healthMultiplier: apiRecord.health_multiplier,
      cbd: apiRecord.cbd,
      cbdMultiplier: apiRecord.cbd_multiplier,
      crypto: apiRecord.crypto,
      cryptoMultiplier: apiRecord.crypto_multiplier,
      gambling: apiRecord.gambling,
      gamblingMultiplier: apiRecord.gambling_multiplier,
      erotic: apiRecord.erotic,
      eroticMultiplier: apiRecord.erotic_multiplier,
      eroticPrice: apiRecord.erotic_price,
    }
  }

  // Convert Sanity image reference to CDN URL
  const getImageUrl = (ref: string): string => {
    // Format: image-{hash}-{width}x{height}-{ext}
    // Convert to: {hash}-{width}x{height}.{ext}
    const cleaned = ref.replace('image-', '')
    return `https://cdn.sanity.io/images/8n90kyzz/production/${cleaned.replace(/-png$/, '.png').replace(/-jpg$/, '.jpg').replace(/-jpeg$/, '.jpeg').replace(/-webp$/, '.webp')}`
  }

  // Get Supabase storage URL from logo reference
  const getSupabaseLogoUrl = async (ref: string): Promise<string | null> => {
    try {
      // Parse reference: image-{hash}-{width}x{height}-{ext}
      // For Supabase uploads, we need to query storage to find the file
      // Since we can't reconstruct filename from hash alone, we'll need to list and match
      // This is not ideal - better would be to store filename mapping
      // For now, return null and handle in display logic
      return null
    } catch (error) {
      console.error('Error getting Supabase logo URL:', error)
      return null
    }
  }

  // Get articlePreview URL (handles both object and null)
  const getArticlePreviewUrl = (articlePreview: Publication['articlePreview']): string | null => {
    if (!articlePreview || !articlePreview.asset) {
      return null
    }
    return getImageUrl(articlePreview.asset._ref)
  }

  // Get user ID for user-specific pricing
  const userId = useUserId()
  const { refreshTrigger } = useVisibilityChange()

  // Refetch publications data (reusable function)
  // This only fetches data from API, doesn't apply filters
  const fetchPublications = useCallback(async () => {
    try {
      // Only show loading on initial load, not on refreshes
      if (!hasFetchedRef.current) {
        setIsLoading(true)
      }
      const { authenticatedFetch } = await import('@/lib/authenticated-fetch')
      const response = await authenticatedFetch('/api/publications', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate'
        }
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('❌ [Publications] API error:', response.status, errorData)
        if (response.status === 401) {
          console.error('❌ [Publications] Authentication failed - checking localStorage...')
          const { shouldRedirectToLogin } = await import('@/lib/authenticated-fetch')
          if (shouldRedirectToLogin()) {
            window.location.href = '/login'
            return
          } else {
            console.log('✅ [Publications] Valid localStorage session, continuing...')
            return // Don't throw error, just return
          }
        }
        throw new Error(`API error: ${response.status}`)
      }
      
      const data = await response.json()
      
      // Handle different response formats
      let publications: Publication[] = []
      if (Array.isArray(data)) {
        publications = data as Publication[]
      } else if (data && typeof data === 'object' && 'result' in data && Array.isArray(data.result)) {
        publications = data.result as Publication[]
      } else if (data && typeof data === 'object' && Array.isArray(data.data)) {
        publications = data.data as Publication[]
      } else {
        console.warn('⚠️ [Publications] Unexpected data format:', data)
        publications = []
      }
      
      console.log(`✅ [Publications] Parsed ${publications.length} publications from API response`)
      
      if (publications.length > 0) {
        // Calculate max price from the fetched data
        const prices = publications.map((pub: Publication) => {
          if (pub.customPrice && pub.customPrice.length > 0) {
            return typeof pub.customPrice[0] === 'string' ? parseFloat(pub.customPrice[0]) : pub.customPrice[0]
          }
          if (pub.defaultPrice && pub.defaultPrice.length > 0) {
            return typeof pub.defaultPrice[0] === 'string' ? parseFloat(pub.defaultPrice[0]) : pub.defaultPrice[0]
          }
          return 0
        }).filter(price => price > 0)
        
        const calculatedMaxPrice = prices.length > 0 ? Math.max(...prices) : 0
        console.log(`💰 [Publications] Calculated max price: ${calculatedMaxPrice}`)
        
        // Set price range to [0, maxPrice] so all items are visible initially
        const initialPriceRange: [number, number] = [0, calculatedMaxPrice]
        
        // Set the data and price range together
        setPublicationsData(publications)
        setPriceRange(initialPriceRange)
        
        // Filters will be applied automatically by the useEffect that watches filter changes
      } else {
        setPublicationsData([])
        setFilteredData([])
      }
    } catch (error) {
      console.error('Error fetching publications:', error)
      setPublicationsData([])
      setFilteredData([])
    } finally {
      setIsLoading(false)
    }
  }, []) // Remove all filter dependencies - only fetch data, filtering is handled separately

  // Define applyFilters before using it in useEffect
  // Optimized to do all filtering in a single pass for better performance
  const applyFilters = useCallback((
    search: string,
    price: number[],
    sort: string,
    genres: string[],
    types: string[],
    sponsored: string,
    dofollow: string,
    indexed: string,
    image: string,
    niches: string[]
  ) => {
    if (!publicationsData || publicationsData.length === 0) {
      setFilteredData([])
      return
    }
    
    // Pre-compute lowercase search term once
    const searchLower = search ? search.toLowerCase() : ''
    
    // Single pass filtering - much more efficient than multiple filter calls
    let filtered = publicationsData.filter(pub => {
      // Search filter
      if (searchLower && (!pub.name || !pub.name.toLowerCase().includes(searchLower))) {
        return false
      }

      // Price filter
      const priceNum = getPrice(pub)
      if (priceNum < price[0] || priceNum > price[1]) {
        return false
      }

      // Genre filter
      if (genres.length > 0) {
        const hasGenre = genres.some(genre => 
          pub.genres?.some(g => g.name.toLowerCase() === genre.toLowerCase()) || false
        )
        if (!hasGenre) return false
      }

      // Type filter
      if (types.length > 0) {
        const hasType = types.some(type => 
          pub.name?.toLowerCase().includes(type.toLowerCase()) || 
          getGenresArray(pub).some(g => g.toLowerCase().includes(type.toLowerCase()))
        )
        if (!hasType) return false
      }

      // Sponsored filter
      if (sponsored && pub.sponsored?.toLowerCase() !== sponsored.toLowerCase()) {
        return false
      }

      // Do follow filter
      if (dofollow && pub.do_follow?.toLowerCase() !== dofollow.toLowerCase()) {
        return false
      }

      // Indexed filter
      if (indexed && pub.indexed?.toLowerCase() !== indexed.toLowerCase()) {
        return false
      }

      // Image filter
      if (image && pub.image?.toLowerCase() !== image.toLowerCase()) {
        return false
      }

      // Niche filter
      if (niches.length > 0) {
        const pubNiches = getNichesArray(pub)
        const hasNiche = niches.some(niche => 
          pubNiches.some(pn => pn.toLowerCase() === niche.toLowerCase())
        )
        if (!hasNiche) return false
      }

      return true
    }) as Publication[]

    // Sort only if needed
    if (sort.includes('Price')) {
      const isAsc = sort.includes('Asc')
      filtered.sort((a, b) => {
        const priceA = getPrice(a)
        const priceB = getPrice(b)
        return isAsc ? priceA - priceB : priceB - priceA
      })
    }

    setFilteredData(filtered)
  }, [publicationsData])

  // Fetch publications data from API on mount and when tab becomes visible
  useEffect(() => {
    console.log('🔄 [Publications] useEffect triggered - refreshTrigger:', refreshTrigger)
    
    // Prevent duplicate fetches on initial load
    if (!hasFetchedRef.current) {
      console.log('📥 [Publications] Initial fetch')
      hasFetchedRef.current = true
      lastRefreshTriggerRef.current = refreshTrigger
      fetchPublications()
      return
    }
    
    // Only fetch if refreshTrigger actually changed
    if (refreshTrigger !== lastRefreshTriggerRef.current) {
      console.log('📥 [Publications] Refetch due to visibility change')
      lastRefreshTriggerRef.current = refreshTrigger
      fetchPublications()
    } else {
      console.log('⏭️ [Publications] Skipping fetch - same refreshTrigger')
    }
  }, [refreshTrigger]) // Only depend on refreshTrigger, not fetchPublications

  // Apply filters when filter state changes or when data is loaded
  // Use debouncedSearchTerm - filter only applies after user stops typing for 300ms
  // This ensures smooth typing without lag
  useEffect(() => {
    if (publicationsData.length > 0 && priceRange[1] > 0) {
      const searchLower = debouncedSearchTerm.trim().toLowerCase()
      // Use startTransition to mark filtering as non-urgent, preventing input lag
      // This ensures the input remains responsive even when filtering operation starts
      startTransition(() => {
        applyFilters(searchLower, priceRange, sortBy, selectedGenres, selectedTypes, selectedSponsored, selectedDofollow, selectedIndexed, selectedImage, selectedNiches)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchTerm, priceRange, sortBy, selectedGenres, selectedTypes, selectedSponsored, selectedDofollow, selectedIndexed, selectedImage, selectedNiches, publicationsData.length, applyFilters, startTransition]) // Apply filters when they change or data loads


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

  const handleCreateRecord = useCallback(async (formData: any) => {
    setError('')
    setSuccess('')

    try {
      // Generate UUID for _id
      const generateUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0
          const v = c === 'x' ? r : (r & 0x3 | 0x8)
          return v.toString(16)
        })
      }

      // Validate and filter genres - only include genres with non-empty names
      const validGenres = formData.genres 
        ? formData.genres.filter((g: any) => g && g.name && g.name.trim() !== '')
        : []
      
      // Validate and filter regions - only include regions with non-empty names
      const validRegions = formData.regions
        ? formData.regions.filter((r: any) => r && r.name && r.name.trim() !== '')
        : []

      // Transform camelCase to snake_case and prepare data for Supabase
      const transformedData: any = {
        _id: generateUUID(),
        name: formData.name?.trim() || null,
        domain_authority: formData.domain_authority ?? null,
        domain_rating: formData.domain_rating ?? null,
        estimated_time: formData.estimated_time?.trim() || null,
        sponsored: formData.sponsored?.trim() || null,
        indexed: formData.indexed?.trim() || null,
        do_follow: formData.do_follow?.trim() || null,
        image: formData.image?.trim() || null,
        img_explain: formData.img_explain?.trim() || null,
        health: formData.health || false,
        health_multiplier: null,
        cbd: formData.cbd || false,
        cbd_multiplier: null,
        crypto: formData.crypto || false,
        crypto_multiplier: null,
        gambling: formData.gambling || false,
        gambling_multiplier: null,
        erotic: formData.erotic || false,
        erotic_multiplier: null,
        erotic_price: null,
        default_price: formData.defaultPrice && formData.defaultPrice.length > 0 ? formData.defaultPrice : null,
        custom_price: null,
        genres: validGenres.length > 0 ? validGenres : null,
        regions: validRegions.length > 0 ? validRegions : null,
        logo: formData.logo || null,
        article_preview: formData.articlePreview?.trim() 
          ? (formData.articlePreview.trim().startsWith('image-')
              ? {
                  _type: "image",
                  asset: {
                    _ref: formData.articlePreview.trim(),
                    _type: "reference"
                  }
                }
              : formData.articlePreview.trim() // Store as plain text if not an image reference
            )
          : null,
      }

      // Log logo and article preview before transformation
      console.log('📸 Logo from formData:', JSON.stringify(formData.logo))
      console.log('📸 Logo in transformedData:', JSON.stringify(transformedData.logo))
      console.log('📄 ArticlePreview from formData:', formData.articlePreview)
      console.log('📄 ArticlePreview in transformedData:', JSON.stringify(transformedData.article_preview))

      // Convert all empty strings, undefined, and empty arrays to null (except logo, article_preview, and boolean fields)
      Object.keys(transformedData).forEach(key => {
        const value = transformedData[key]
        
        // Skip logo and article_preview - they are JSONB and should be preserved as objects or null
        if (key === 'logo' || key === 'article_preview') {
          return
        }
        
        // Skip boolean fields - they should remain false if not true
        if (key === 'health' || key === 'cbd' || key === 'crypto' || key === 'gambling' || key === 'erotic') {
          return
        }
        
        // Convert empty strings to null
        if (value === '') {
          transformedData[key] = null
        }
        
        // Convert undefined to null
        if (value === undefined) {
          transformedData[key] = null
        }
        
        // Convert empty arrays to null (except for specific fields that should be arrays)
        if (Array.isArray(value) && value.length === 0) {
          transformedData[key] = null
        }
      })
      
      // Final logo check - ensure it's in the correct format for JSONB
      if (transformedData.logo && typeof transformedData.logo === 'object') {
        // Verify logo has the correct structure
        if (!transformedData.logo._type || !transformedData.logo.asset) {
          console.warn('⚠️ Logo format is incorrect, setting to null')
          transformedData.logo = null
        } else {
          console.log('✅ Logo format is correct:', JSON.stringify(transformedData.logo))
        }
      } else if (transformedData.logo === undefined || transformedData.logo === '') {
        transformedData.logo = null
      }
      
      // Ensure article_preview is properly formatted
      if (transformedData.article_preview) {
        if (typeof transformedData.article_preview === 'object') {
          // If it's an object, it should have the image structure
          if (!transformedData.article_preview.asset || !transformedData.article_preview.asset._ref) {
            console.warn('⚠️ Article preview format is incorrect, setting to null')
            transformedData.article_preview = null
          } else {
            console.log('✅ Article preview format is correct (image):', JSON.stringify(transformedData.article_preview))
          }
        } else if (typeof transformedData.article_preview === 'string') {
          // If it's a string, it's plain text - that's valid
          if (transformedData.article_preview.trim() === '') {
            transformedData.article_preview = null
          } else {
            console.log('✅ Article preview is plain text:', transformedData.article_preview.substring(0, 50) + '...')
          }
        }
      } else if (transformedData.article_preview === undefined || transformedData.article_preview === '') {
        transformedData.article_preview = null
      }
      
      console.log('📄 Final article_preview:', JSON.stringify(transformedData.article_preview))

      console.log('🔑 Getting auth token...')
      let token: string
      try {
        token = getAuthToken()
        console.log('🔑 Auth token received:', token ? 'Token exists' : 'No token')
      } catch (tokenError: any) {
        console.error('❌ Failed to get auth token:', tokenError)
        throw new Error(`Authentication failed: ${tokenError.message || 'Please log in again'}`)
      }
      
      if (!token) {
        throw new Error('No authentication token found. Please log in again.')
      }
      
      console.log('📤 Sending data to API:', JSON.stringify(transformedData, null, 2))
      console.log('📄 Article preview in final payload:', JSON.stringify(transformedData.article_preview))
      
      let response: Response
      try {
        response = await fetch('/api/admin/records/publications', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(transformedData)
        })
      } catch (fetchError: any) {
        console.error('❌ Network error:', fetchError)
        throw new Error(`Network error: ${fetchError.message || 'Failed to connect to server'}`)
      }

      console.log('📡 API Response status:', response.status, response.statusText)
      
      let data: any
      try {
        const responseText = await response.text()
        console.log('📥 API Response text:', responseText)
        
        if (!responseText) {
          throw new Error('Empty response from server')
        }
        
        try {
          data = JSON.parse(responseText)
        } catch (parseError) {
          console.error('❌ Failed to parse JSON response:', responseText)
          throw new Error(`Invalid response from server: ${responseText.substring(0, 100)}`)
        }
      } catch (parseError: any) {
        console.error('❌ Error parsing response:', parseError)
        throw new Error(`Failed to parse server response: ${parseError.message}`)
      }

      console.log('📥 API Response data:', data)

      if (!response.ok) {
        console.error('❌ API Error:', data)
        const errorMessage = data?.error || data?.details?.message || data?.message || `Server error: ${response.status} ${response.statusText}`
        throw new Error(errorMessage)
      }

      if (!data.success && !data.record) {
        console.error('❌ Unexpected response format:', data)
        throw new Error('Unexpected response from server')
      }

      console.log('✅ Record created successfully!')
      
      // Transform API response to Publication format and add to state
      const newPublication = transformApiRecordToPublication(data.record)
      
      // Update max price if needed
      const newPrice = getPrice(newPublication)
      if (newPrice > 0 && priceRange[1] < newPrice) {
        setPriceRange([priceRange[0], newPrice])
      }
      
      // Add new record to publicationsData
      // The useEffect watching publicationsData will automatically apply filters
      setPublicationsData(prev => [...prev, newPublication])
      
      setSuccess('Record created successfully!')
      // Close modal and clear messages after a short delay
      setTimeout(() => {
        setShowAddModal(false)
        setSuccess('')
        setError('')
      }, 1500)
    } catch (err: any) {
      console.error('❌ Error creating record:', err)
      console.error('❌ Error stack:', err?.stack)
      const errorMessage = err?.message || err?.toString() || 'Failed to create record. Please try again.'
      setError(errorMessage)
      // Don't close modal on error so user can see the error message
    }
  }, [priceRange])

  const handleUpdateRecord = useCallback(async (formData: any) => {
    if (!editingRecord) return

    setError('')
    setSuccess('')

    try {
      // Validate and filter genres - only include genres with non-empty names
      const validGenres = formData.genres 
        ? formData.genres.filter((g: any) => g && g.name && g.name.trim() !== '')
        : []
      
      // Validate and filter regions - only include regions with non-empty names
      const validRegions = formData.regions
        ? formData.regions.filter((r: any) => r && r.name && r.name.trim() !== '')
        : []

      // Transform camelCase to snake_case and prepare data for Supabase
      const transformedData: any = {
        _id: editingRecord._id, // Keep existing _id
        name: formData.name?.trim() || null,
        domain_authority: formData.domain_authority ?? null,
        domain_rating: formData.domain_rating ?? null,
        estimated_time: formData.estimated_time?.trim() || null,
        sponsored: formData.sponsored?.trim() || null,
        indexed: formData.indexed?.trim() || null,
        do_follow: formData.do_follow?.trim() || null,
        image: formData.image?.trim() || null,
        img_explain: formData.img_explain?.trim() || null,
        health: formData.health || false,
        health_multiplier: null,
        cbd: formData.cbd || false,
        cbd_multiplier: null,
        crypto: formData.crypto || false,
        crypto_multiplier: null,
        gambling: formData.gambling || false,
        gambling_multiplier: null,
        erotic: formData.erotic || false,
        erotic_multiplier: null,
        erotic_price: null,
        default_price: formData.defaultPrice && formData.defaultPrice.length > 0 ? formData.defaultPrice : null,
        custom_price: null,
        genres: validGenres.length > 0 ? validGenres : null,
        regions: validRegions.length > 0 ? validRegions : null,
        logo: formData.logo || null,
        article_preview: formData.articlePreview?.trim() 
          ? (formData.articlePreview.trim().startsWith('image-')
              ? {
                  _type: "image",
                  asset: {
                    _ref: formData.articlePreview.trim(),
                    _type: "reference"
                  }
                }
              : formData.articlePreview.trim()
            )
          : null,
      }

      // Convert all empty strings, undefined, and empty arrays to null
      Object.keys(transformedData).forEach(key => {
        const value = transformedData[key]
        
        if (key === 'logo' || key === 'article_preview' || key === '_id') {
          return
        }
        
        if (key === 'health' || key === 'cbd' || key === 'crypto' || key === 'gambling' || key === 'erotic') {
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

      // Final logo check
      if (transformedData.logo && typeof transformedData.logo === 'object') {
        if (!transformedData.logo._type || !transformedData.logo.asset) {
          console.warn('⚠️ Logo format is incorrect, setting to null')
          transformedData.logo = null
        }
      } else if (transformedData.logo === undefined || transformedData.logo === '') {
        transformedData.logo = null
      }
      
      // Ensure article_preview is properly formatted
      if (transformedData.article_preview) {
        if (typeof transformedData.article_preview === 'object') {
          if (!transformedData.article_preview.asset || !transformedData.article_preview.asset._ref) {
            console.warn('⚠️ Article preview format is incorrect, setting to null')
            transformedData.article_preview = null
          }
        } else if (typeof transformedData.article_preview === 'string') {
          if (transformedData.article_preview.trim() === '') {
            transformedData.article_preview = null
          }
        }
      } else if (transformedData.article_preview === undefined || transformedData.article_preview === '') {
        transformedData.article_preview = null
      }

      const token = getAuthToken()
      
      if (!token) {
        throw new Error('No authentication token found. Please log in again.')
      }

      const response = await fetch(`/api/admin/records/publications?id=${editingRecord._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(transformedData)
      })

      let data: any
      try {
        const responseText = await response.text()
        if (!responseText) {
          throw new Error('Empty response from server')
        }
        data = JSON.parse(responseText)
      } catch (parseError: any) {
        throw new Error(`Failed to parse server response: ${parseError.message}`)
      }

      if (!response.ok) {
        const errorMessage = data?.error || data?.details?.message || data?.message || `Server error: ${response.status} ${response.statusText}`
        throw new Error(errorMessage)
      }

      if (!data.success && !data.record) {
        throw new Error('Unexpected response from server')
      }

      // Transform API response to Publication format and update state
      const updatedPublication = transformApiRecordToPublication(data.record)
      
      // Update record in publicationsData
      setPublicationsData(prev => prev.map(pub => 
        pub._id === editingRecord._id ? updatedPublication : pub
      ))
      
      // Update filtered data as well
      setFilteredData(prev => prev.map(pub => 
        pub._id === editingRecord._id ? updatedPublication : pub
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
      const errorMessage = err?.message || err?.toString() || 'Failed to update record. Please try again.'
      setError(errorMessage)
    }
  }, [editingRecord])

  const handleDeleteRecord = useCallback(async (recordId: string) => {
    if (!confirm('Are you sure you want to delete this record?')) return

    try {
      setDeletingRecordId(recordId)
      setError('')
      setSuccess('')
      
      const token = getAuthToken()
      const response = await fetch(`/api/admin/records/publications?id=${recordId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete record')
      }

      // Remove record from state instead of refetching
      setPublicationsData(prev => prev.filter(pub => pub._id !== recordId))
      setFilteredData(prev => prev.filter(pub => pub._id !== recordId))
      
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


  // Calculate max price from data safely - memoized to prevent recalculation on every render
  const maxPrice = useMemo(() => {
    const prices = publicationsData.map(pub => getPrice(pub as Publication)).filter(price => price > 0)
    if (prices.length === 0) {
      return 0
    }
    const maxPrice = Math.max(...prices)
    // Return the actual max price, or 85000 as fallback if somehow all prices are invalid
    return maxPrice > 0 ? maxPrice : 0
  }, [publicationsData])
  
  // Update price range only when maxPrice changes and priceRange hasn't been set yet
  useEffect(() => {
    if (maxPrice > 0 && priceRange[1] === 0) {
      setPriceRange([0, maxPrice])
    }
  }, [maxPrice]) // Remove priceRange from dependencies to avoid infinite loop
  
  // Apply filters when publicationsData changes and priceRange is properly set
  // This is a safety net in case filteredData wasn't set properly on initial load
  useEffect(() => {
    // Only re-apply if we have data, price range is set, but filteredData is still empty
    // This handles edge cases where the initial filter application didn't work
    if (publicationsData.length > 0 && priceRange[1] > 0 && filteredData.length === 0 && !debouncedSearchTerm && selectedGenres.length === 0 && selectedTypes.length === 0) {
      console.log(`🔄 [Publications] Re-applying filters (filteredData was empty): ${publicationsData.length} items, price range [${priceRange[0]}, ${priceRange[1]}]`)
      applyFilters('', priceRange, sortBy, selectedGenres, selectedTypes, selectedSponsored, selectedDofollow, selectedIndexed, selectedImage, selectedNiches)
    }
  }, [publicationsData.length, debouncedSearchTerm]) // Only re-run when data length changes, not price range
  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    // Update input immediately - this must be synchronous for responsive typing
    // The expensive filtering is debounced and happens in useEffect via debouncedSearchTerm
    setSearchInput(e.target.value)
  }, [])

  const toggleFilter = (
    filterArray: string[],
    setFilterArray: (filters: string[]) => void,
    value: string
  ) => {
    if (filterArray.includes(value)) {
      setFilterArray(filterArray.filter(f => f !== value))
    } else {
      setFilterArray([...filterArray, value])
    }
  }

  const getGenresArray = (pub: Publication): string[] => {
    if (!pub.genres || !Array.isArray(pub.genres)) return []
    return pub.genres.map(g => g?.name || '').filter(Boolean)
  }

  const getRegionsArray = (pub: Publication): string[] => {
    if (!pub.regions || !Array.isArray(pub.regions)) return []
    return pub.regions.map(r => r?.name || '').filter(Boolean)
  }

  const getNichesArray = (pub: Publication): string[] => {
    const nichesList: string[] = []
    if (pub.health === true) nichesList.push('Health')
    if (pub.cbd === true) nichesList.push('CBD')
    if (pub.crypto === true) nichesList.push('Crypto')
    if (pub.gambling === true) nichesList.push('Gambling')
    if (pub.erotic === true) nichesList.push('Erotic')
    return nichesList
  }

  const getNicheInfo = (pub: Publication, basePrice: number) => {
    const niches = [
      { name: 'erotic', displayName: 'erotic', accepted: pub.erotic === true, multiplier: pub.eroticMultiplier, price: pub.eroticPrice },
      { name: 'Health', displayName: 'health content', accepted: pub.health === true, multiplier: pub.healthMultiplier, price: null },
      { name: 'CBD', displayName: 'Cbd content', accepted: pub.cbd === true, multiplier: pub.cbdMultiplier, price: null },
      { name: 'Crypto', displayName: 'Crypto content', accepted: pub.crypto === true, multiplier: pub.cryptoMultiplier, price: null },
      { name: 'Gambling', displayName: 'Gambling content', accepted: pub.gambling === true, multiplier: pub.gamblingMultiplier, price: null }
    ]

    return niches.map(niche => {
      let nichePrice = null
      if (niche.accepted) {
        if (niche.name === 'erotic') {
          // Erotic can have direct price or multiplier
          if (niche.price !== null && niche.price !== undefined) {
            nichePrice = niche.price
          } else if (niche.multiplier) {
            nichePrice = Math.round(basePrice * parseFloat(niche.multiplier))
          } else {
            nichePrice = basePrice
          }
        } else if (niche.multiplier) {
          nichePrice = Math.round(basePrice * parseFloat(niche.multiplier))
        } else {
          nichePrice = basePrice
        }
      }
      return { ...niche, price: nichePrice }
    })
  }

  const resetFilters = () => {
    setSearchInput('')
    setPriceRange([0, maxPrice])
    setSortBy('Price (Asc)')
    setSelectedGenres([])
    setSelectedTypes([])
    setSelectedSponsored('')
    setSelectedDofollow('')
    setSelectedIndexed('')
    setSelectedImage('')
    setSelectedNiches([])
    applyFilters('', [0, maxPrice], 'Price (Asc)', [], [], '', '', '', '', [])
  }


  if (isLoading) {
    return (
      <div className="opacity-100">
        <div className="flex items-center justify-center p-8">
          <p className="text-gray-500">Loading publications...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="opacity-100">
      <div className="flex lg:space-x-4 flex-col lg:flex-row">
        <aside className="font-body mt-2 space-y-4 bg-white border p-4 lg:border-none lg:p-0 lg:bg-transparent w-full lg:w-[350px] filter-sidebar-container">
          <div className="space-y-2">
            <div className="space-y-1">
              <p className="text-sm">Publication name</p>
              <input
                type="text"
                className="text-sm w-full p-2 placeholder:text-gray-400 placeholder:font-base border-2 bg-white"
                placeholder="Search publication name"
                value={searchInput}
                onChange={handleSearch}
              />
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
              .filter-sidebar-container {
                scrollbar-width: none;
                -ms-overflow-style: none;
              }
              .filter-sidebar-container::-webkit-scrollbar {
                display: none;
              }
            ` }} />
            <div className="space-y-1">
              <style dangerouslySetInnerHTML={{ __html: `
                .dual-range-slider input[type="range"]::-webkit-slider-thumb {
                  -webkit-appearance: none;
                  appearance: none;
                  pointer-events: all;
                  width: 20px;
                  height: 20px;
                  background: #dc2626;
                  border: none;
                  border-radius: 4px;
                  cursor: pointer;
                }
                .dual-range-slider input[type="range"]::-moz-range-thumb {
                  pointer-events: all;
                  width: 20px;
                  height: 20px;
                  background: #dc2626;
                  border: none;
                  border-radius: 4px;
                  cursor: pointer;
                }
                .dual-range-slider input[type="range"]::-webkit-slider-thumb:hover {
                  background: #b91c1c;
                }
                .dual-range-slider input[type="range"]::-moz-range-thumb:hover {
                  background: #b91c1c;
                }
              ` }} />
              <p className="text-sm">Price range</p>
              <div className="relative px-2 py-3 dual-range-slider">
                <div className="relative h-2">
                  {/* Track background */}
                  <div className="absolute w-full h-2 bg-black/10 rounded-full"></div>
                  {/* Active track */}
                  <div 
                    className="absolute h-2 bg-primary/50 rounded-full"
                    style={{ 
                      left: `${maxPrice > 0 ? (priceRange[0] / maxPrice) * 100 : 0}%`, 
                      right: `${maxPrice > 0 ? 100 - (priceRange[1] / maxPrice) * 100 : 100}%` 
                    }}
                  />
                  
                  {/* Min range input */}
                <input
                  ref={minRangeRef}
                  type="range"
                  min="0"
                  max={maxPrice}
                  value={priceRange[0]}
                  onChange={(e) => {
                    const newValue = parseInt(e.target.value)
                      // Ensure min doesn't exceed max
                    const newRange = [Math.min(newValue, priceRange[1] - 1), priceRange[1]] as [number, number]
                    setPriceRange(newRange)
                    applyFilters(debouncedSearchTerm.trim().toLowerCase(), newRange, sortBy, selectedGenres, selectedTypes, selectedSponsored, selectedDofollow, selectedIndexed, selectedImage, selectedNiches)
                  }}
                    className="absolute w-full -top-1 h-4 bg-transparent appearance-none pointer-events-none"
                  style={{ 
                      zIndex: priceRange[0] > priceRange[1] - 100 ? 5 : 3,
                      WebkitAppearance: 'none',
                      MozAppearance: 'none'
                  }}
                />
                  
                  {/* Max range input */}
                <input
                  ref={maxRangeRef}
                  type="range"
                  min="0"
                  max={maxPrice}
                  value={priceRange[1]}
                  onChange={(e) => {
                    const newValue = parseInt(e.target.value)
                      // Ensure max doesn't go below min
                    const newRange = [priceRange[0], Math.max(newValue, priceRange[0] + 1)] as [number, number]
                    setPriceRange(newRange)
                    applyFilters(debouncedSearchTerm.trim().toLowerCase(), newRange, sortBy, selectedGenres, selectedTypes, selectedSponsored, selectedDofollow, selectedIndexed, selectedImage, selectedNiches)
                  }}
                    className="absolute w-full -top-1 h-4 bg-transparent appearance-none pointer-events-none"
                  style={{ 
                      zIndex: 4,
                      WebkitAppearance: 'none',
                      MozAppearance: 'none'
                  }}
                />
              </div>
                
                {/* Price labels */}
                <div className="flex justify-between mt-3 text-gray-600">
                <span className="text-sm">${priceRange[0].toLocaleString()}</span>
                <span className="text-sm">${priceRange[1].toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-sm">Sort by</p>
              <div className="relative text-sm">
                <button className="relative w-full bg-white border-2 p-2 text-left">
                  <span className="block text-left text-gray-500 truncate">{sortBy}</span>
                </button>
                <select
                  className="absolute inset-0 w-full opacity-0 cursor-pointer"
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value)
                    applyFilters(debouncedSearchTerm.trim().toLowerCase(), priceRange, e.target.value, selectedGenres, selectedTypes, selectedSponsored, selectedDofollow, selectedIndexed, selectedImage, selectedNiches)
                  }}
                >
                  <option>Price (Asc)</option>
                  <option>Price (Desc)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-sm">Select regions</p>
              <div className="relative text-sm">
                <input
                  type="text"
                  className="w-full bg-white border-2 p-2"
                  placeholder="Select regions"
                  readOnly
                />
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-sm">Select genres</p>
              <div className="flex flex-wrap gap-1">
                {genres.map((genre) => (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => {
                      const newGenres = selectedGenres.includes(genre)
                        ? selectedGenres.filter(g => g !== genre)
                        : [...selectedGenres, genre]
                      setSelectedGenres(newGenres)
                      applyFilters(debouncedSearchTerm.trim().toLowerCase(), priceRange, sortBy, newGenres, selectedTypes, selectedSponsored, selectedDofollow, selectedIndexed, selectedImage, selectedNiches)
                    }}
                    className={`text-sm cursor-pointer p-1 px-2 ${
                      selectedGenres.includes(genre)
                        ? 'bg-primary text-white'
                        : 'bg-[#6e6e6e] text-white'
                    }`}
                  >
                    {genre}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-sm">Type</p>
              <div className="flex flex-wrap gap-1">
                {types.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      const newTypes = selectedTypes.includes(type)
                        ? selectedTypes.filter(t => t !== type)
                        : [...selectedTypes, type]
                      setSelectedTypes(newTypes)
                      applyFilters(debouncedSearchTerm.trim().toLowerCase(), priceRange, sortBy, selectedGenres, newTypes, selectedSponsored, selectedDofollow, selectedIndexed, selectedImage, selectedNiches)
                    }}
                    className={`text-sm cursor-pointer p-1 px-2 ${
                      selectedTypes.includes(type)
                        ? 'bg-primary text-white'
                        : 'bg-[#6e6e6e] text-white'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-sm">Sponsored</p>
              <div className="flex flex-wrap gap-1">
                {['Yes', 'No', 'Discrete'].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      const newVal = selectedSponsored === val ? '' : val
                      setSelectedSponsored(newVal)
                      applyFilters(debouncedSearchTerm.trim().toLowerCase(), priceRange, sortBy, selectedGenres, selectedTypes, newVal, selectedDofollow, selectedIndexed, selectedImage, selectedNiches)
                    }}
                    className={`text-sm cursor-pointer p-1 px-2 ${
                      selectedSponsored === val
                        ? 'bg-primary text-white'
                        : 'bg-[#6e6e6e] text-white'
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-sm">Do follow</p>
              <div className="flex flex-wrap gap-1">
                {['Yes', 'No'].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      const newVal = selectedDofollow === val ? '' : val
                      setSelectedDofollow(newVal)
                      applyFilters(debouncedSearchTerm.trim().toLowerCase(), priceRange, sortBy, selectedGenres, selectedTypes, selectedSponsored, newVal, selectedIndexed, selectedImage, selectedNiches)
                    }}
                    className={`text-sm cursor-pointer p-1 px-2 ${
                      selectedDofollow === val
                        ? 'bg-primary text-white'
                        : 'bg-[#6e6e6e] text-white'
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-sm">Indexed</p>
              <div className="flex flex-wrap gap-1">
                {['Yes', 'Maybe', 'No'].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      const newVal = selectedIndexed === val ? '' : val
                      setSelectedIndexed(newVal)
                      applyFilters(debouncedSearchTerm.trim().toLowerCase(), priceRange, sortBy, selectedGenres, selectedTypes, selectedSponsored, selectedDofollow, newVal, selectedImage, selectedNiches)
                    }}
                    className={`text-sm cursor-pointer p-1 px-2 ${
                      selectedIndexed === val
                        ? 'bg-primary text-white'
                        : 'bg-[#6e6e6e] text-white'
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-sm">Image</p>
              <div className="flex flex-wrap gap-1">
                {['Yes', 'Maybe'].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      const newVal = selectedImage === val ? '' : val
                      setSelectedImage(newVal)
                      applyFilters(debouncedSearchTerm.trim().toLowerCase(), priceRange, sortBy, selectedGenres, selectedTypes, selectedSponsored, selectedDofollow, selectedIndexed, newVal, selectedNiches)
                    }}
                    className={`text-sm cursor-pointer p-1 px-2 ${
                      selectedImage === val
                        ? 'bg-primary text-white'
                        : 'bg-[#6e6e6e] text-white'
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-sm">Niche</p>
              <div className="flex flex-wrap gap-1">
                {niches.map((niche) => (
                  <button
                    key={niche}
                    type="button"
                    onClick={() => {
                      const newNiches = selectedNiches.includes(niche)
                        ? selectedNiches.filter(n => n !== niche)
                        : [...selectedNiches, niche]
                      setSelectedNiches(newNiches)
                      applyFilters(debouncedSearchTerm.trim().toLowerCase(), priceRange, sortBy, selectedGenres, selectedTypes, selectedSponsored, selectedDofollow, selectedIndexed, selectedImage, newNiches)
                    }}
                    className={`text-sm cursor-pointer p-1 px-2 ${
                      selectedNiches.includes(niche)
                        ? 'bg-primary text-white'
                        : 'bg-[#6e6e6e] text-white'
                    }`}
                  >
                    {niche}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={resetFilters}
              className="text-sm hover:underline"
            >
              Reset all filters
            </button>
          </div>
        </aside>

        <section className="w-full mt-2">
          <div className="flex justify-between items-center mb-1">
            <p className="font-body text-sm">
              SHOWING {filteredData.length} OF {publicationsData.length} PUBLICATIONS
            </p>
            {isAdmin && (
              <button
                onClick={() => {
                  setEditingRecord(null)
                  setShowAddModal(true)
                }}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Add Publication
              </button>
            )}
          </div>
          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-800">{error}</div>
            </div>
          )}
          {success && (
            <div className="mb-4 rounded-md bg-green-50 p-4">
              <div className="text-sm text-green-800">{success}</div>
            </div>
          )}
          <div className="overflow-x-scroll lg:overflow-visible relative" style={{ overflow: 'visible' }}>
            <table className="w-full divide-y divide-gray-300 overflow-hidden lg:overflow-visible border bg-white" style={{ overflow: 'visible' }}>
              <thead className="text-xs text-gray-700 bg-white sticky top-0 z-20 shadow-sm">
                <tr className="text-primary">
                  <th className="font-body font-medium border-l border-r uppercase p-2 px-2">
                    <div className="flex">Publication</div>
                  </th>
                  <th className="font-body font-medium border-l border-r uppercase p-2 px-2">
                    <div className="flex justify-center">Genres</div>
                  </th>
                  <th className="font-body font-medium border-l border-r uppercase p-2 px-2">
                    <div className="flex justify-center">Price</div>
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
                    <div className="flex justify-center">Image</div>
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
              <tbody className="divide-y divide-gray-200 relative z-0">
                {Array.isArray(filteredData) && filteredData.map((pub, index) => {
                  const price = getPrice(pub)
                  const genresArray = getGenresArray(pub)
                  const regionsArray = getRegionsArray(pub)
                  const nichesArray = getNichesArray(pub)
                  const articlePreviewUrl = getArticlePreviewUrl(pub.articlePreview)
                  
                  return (
                  <tr key={pub._id || index} className="text-sm">
                    <td className="py-2 px-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {pub.logo && pub.logo.asset && (() => {
                            // Check if this is a Supabase upload (has metadata with filename)
                            const asset = pub.logo.asset as any
                            let imageUrl: string
                            
                            if (asset._metadata && asset._metadata.isSupabaseUpload && asset._metadata.storagePath) {
                              // Supabase storage upload - construct URL dynamically using Supabase client
                              const { data: { publicUrl } } = supabase.storage
                                .from('publications')
                                .getPublicUrl(asset._metadata.storagePath)
                              imageUrl = publicUrl
                            } else {
                              // Legacy Sanity format - use Sanity CDN
                              const ref = asset._ref.replace('image-', '')
                              imageUrl = `https://cdn.sanity.io/images/8n90kyzz/production/${ref.replace(/-png$/, '.png').replace(/-jpg$/, '.jpg').replace(/-jpeg$/, '.jpeg').replace(/-webp$/, '.webp')}?w=80&h=80&fit=crop&auto=format&q=75`
                            }
                            return (
                              <div className="inline-flex w-10 h-10">
                                <img
                                  alt={`${pub.name || 'Publication'} image`}
                                  src={imageUrl}
                                  className="w-10 h-10 object-cover rounded-full"
                                  width="40"
                                  height="40"
                                  loading={index < 10 ? "eager" : "lazy"}
                                  decoding="async"
                                  fetchPriority={index < 5 ? "high" : "low"}
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none'
                                  }}
                                />
                              </div>
                            )
                          })()}
                          <p>{pub.name || 'N/A'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-center border-l border-r relative">
                      {genresArray.length === 0 ? (
                        '-'
                      ) : genresArray.length > 2 ? (
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
                              onMouseEnter={(e) => {
                                e.stopPropagation()
                                setHoveredIndex(index)
                                setHoveredColumn('genres')
                              }}
                              onMouseLeave={(e) => {
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
                                  {genresArray.map((genre, genreIndex) => (
                                    <span
                                      key={genreIndex}
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
                      ) : (
                        <div className="flex flex-wrap justify-center gap-1">
                          {genresArray.map((genre, genreIndex) => (
                            <span
                              key={genreIndex}
                              className="text-xs font-medium mr-1 px-2.5 py-0.5 rounded bg-gray-100 text-gray-800"
                            >
                              {genre}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="text-center border-l border-r">${price.toLocaleString()}</td>
                    <td className="text-center border-l border-r">{pub.domain_authority || '-'}</td>
                    <td className="text-center border-l border-r">{pub.domain_rating || '-'}</td>
                    <td className="text-center border-l border-r">{pub.estimated_time || '-'}</td>
                    <td className="text-center border-l border-r relative">
                      {regionsArray.length === 0 ? (
                        '-'
                      ) : regionsArray.length > 2 ? (
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
                              <span className="mr-1 text-gray-500">{regionsArray.length} regions</span>
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
                              onMouseEnter={(e) => {
                                e.stopPropagation()
                                setHoveredIndex(index)
                                setHoveredColumn('regions')
                              }}
                              onMouseLeave={(e) => {
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
                                  {regionsArray.map((region, regionIndex) => (
                                    <span
                                      key={regionIndex}
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
                      ) : (
                        <div className="flex flex-wrap justify-center gap-1">
                          {regionsArray.map((region, regionIndex) => (
                            <span
                              key={regionIndex}
                              className="text-xs font-medium mr-1 px-2.5 py-0.5 rounded bg-gray-100 text-gray-800"
                            >
                              {region}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="text-center border-l border-r">{pub.sponsored || '-'}</td>
                    <td className="text-center border-l border-r">{pub.indexed || '-'}</td>
                    <td className="text-center border-l border-r">{pub.do_follow || '-'}</td>
                    <td className="text-center border-l border-r relative">
                      {(articlePreviewUrl || pub.url) && (
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
                              href={articlePreviewUrl || pub.url || '#'}
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
                              onMouseEnter={(e) => {
                                e.stopPropagation()
                                setHoveredIndex(index)
                                setHoveredColumn('example')
                              }}
                              onMouseLeave={(e) => {
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
                                  {articlePreviewUrl ? (
                                    <img 
                                      alt={`${pub.name} preview`}
                                      loading="lazy"
                                      width="250"
                                      height="200"
                                      decoding="async"
                                      fetchPriority="low"
                                      className="object-cover border"
                                      src={articlePreviewUrl.includes('?') ? `${articlePreviewUrl}&w=250&h=200&fit=crop&auto=format&q=80` : `${articlePreviewUrl}?w=250&h=200&fit=crop&auto=format&q=80`}
                                      onError={(e) => {
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
                    <td className="text-center border-l border-r relative">
                      {(articlePreviewUrl || pub.url) && (
                        <div
                          className="relative inline-block"
                          onMouseEnter={() => {
                            setHoveredIndex(index)
                            setHoveredColumn('image')
                          }}
                          onMouseLeave={() => {
                            setHoveredIndex(null)
                            setHoveredColumn(null)
                          }}
                        >
                          <a
                            href={articlePreviewUrl || pub.url || '#'}
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
                          {hoveredIndex === index && hoveredColumn === 'image' && (
                            <div 
                              data-radix-popper-content-wrapper=""
                              className="absolute z-50 left-1/2 transform -translate-x-1/2 bottom-full mb-2"
                              style={{
                                minWidth: 'max-content',
                                willChange: 'transform'
                              }}
                              onMouseEnter={(e) => {
                                e.stopPropagation()
                                setHoveredIndex(index)
                                setHoveredColumn('image')
                              }}
                              onMouseLeave={(e) => {
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
                                  <p className="font-body text-sm">
                                    {pub.img_explain || 'No Explanation'}
                                  </p>
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
                    {/* <td className="text-center border-l border-r">{pub.image || '-'}</td> */}
                    <td className="text-center border-l border-r min-w-[120px] relative">
                      <div className="flex justify-between px-[4px]">
                        {(() => {
                          const nicheIcons = [
                            { name: 'erotic', displayName: 'erotic' },
                            { name: 'Health', displayName: 'health content' },
                            { name: 'CBD', displayName: 'Cbd content' },
                            { name: 'Crypto', displayName: 'Crypto content' },
                            { name: 'Gambling', displayName: 'Gambling content' }
                          ]
                          const nicheInfo = getNicheInfo(pub, price)
                          
                          return nicheIcons.map((icon, iconIndex) => {
                            const niche = nicheInfo.find(n => n.name === icon.name || (icon.name === 'erotic' && n.name === 'erotic'))
                            const nicheKey = `${index}-niche-${iconIndex}`
                            const isHovered = hoveredNicheIcon?.index === index && hoveredNicheIcon?.niche === icon.name
                            
                            return (
                              <div key={iconIndex} className="relative">
                                <div className="w-[24px] h-[24px] mx-auto">
                                  <button 
                                    className="inline-flex items-center justify-center" 
                                    data-state="closed"
                                    style={{
                                      color: niche && niche.accepted && niche.price !== null ? 'currentColor' : '#9ca3af'
                                    }}
                                    onMouseEnter={() => {
                                      setHoveredNicheIcon({ index, niche: icon.name })
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
                                    onMouseEnter={(e) => {
                                      e.stopPropagation()
                                      setHoveredNicheIcon({ index, niche: icon.name })
                                    }}
                                    onMouseLeave={(e) => {
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
                                      {niche.accepted && niche.price !== null ? (
                                        <span className="text-sm">{niche.displayName} price: ${niche.price.toLocaleString()}</span>
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
                              setEditingRecord(pub)
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
                            onClick={() => handleDeleteRecord(pub._id)}
                            disabled={deletingRecordId === pub._id}
                            className="text-red-600 hover:text-red-900 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[80px]"
                          >
                            {deletingRecordId === pub._id ? (
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
                )
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {showAddModal && (
        <AddPublicationForm
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
