'use client'

import { useState, useEffect } from 'react'
import { useUserId } from '@/hooks/useUserId'
import { useIsAdmin } from '@/hooks/useIsAdmin'
import { useVisibilityChange } from '@/hooks/useVisibilityChange'
import { isPriceAdjusted, getAdjustmentInfo, hasActiveAdjustments } from '@/lib/price-adjustment-utils'
import { createClient } from '@/lib/supabase-client'
import AddSocialPostForm from './AddSocialPostForm'

interface SocialPost {
  id?: string
  publication: string
  image: string
  url: string
  platforms: string[]
  price: string
  tat: string
  exampleUrl: string
}

const genres = ['News', 'Lifestyle', 'Luxury', 'Fashion', 'Entertainment', 'Tech', 'Business', 'Sports', 'Real Estate', 'Music']

export default function SocialPostTab() {
  const [socialPostData, setSocialPostData] = useState<SocialPost[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [filteredData, setFilteredData] = useState<SocialPost[]>([])
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [hoveredColumn, setHoveredColumn] = useState<'example' | null>(null)
  const [priceAdjustments, setPriceAdjustments] = useState<any>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingRecord, setEditingRecord] = useState<SocialPost | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null)

  const userId = useUserId()
  const isAdmin = useIsAdmin()
  const { refreshTrigger } = useVisibilityChange()
  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        const { authenticatedFetch } = await import('@/lib/authenticated-fetch')
        const response = await authenticatedFetch('/api/social-posts')
        
        if (!response.ok) {
          let errorData
          try {
            errorData = await response.json()
          } catch (e) {
            errorData = { error: `HTTP ${response.status}: ${response.statusText || 'Unknown error'}` }
          }
          console.error('❌ [Social Posts] API error:', response.status, errorData)
          if (response.status === 401) {
            console.error('❌ [Social Posts] Authentication failed - checking localStorage...')
            const { shouldRedirectToLogin } = await import('@/lib/authenticated-fetch')
            if (shouldRedirectToLogin()) {
              window.location.href = '/login'
              return
            } else {
              console.log('✅ [Social Posts] Valid localStorage session, continuing...')
              setSocialPostData([])
              setFilteredData([])
              setIsLoading(false)
              return
            }
          }
          throw new Error(`API error: ${response.status} - ${errorData.error || 'Unknown error'}`)
        }
        
        const responseData = await response.json()
        
        // Handle new response format with data and priceAdjustments
        let data = responseData
        if (responseData && typeof responseData === 'object' && 'data' in responseData) {
          data = responseData.data
          setPriceAdjustments(responseData.priceAdjustments)
        }
        
        if (Array.isArray(data)) {
          setSocialPostData(data)
          setFilteredData(data)
        } else {
          console.warn('⚠️ [Social Posts] Unexpected data format:', data)
          setSocialPostData([])
          setFilteredData([])
        }
      } catch (error: any) {
        console.error('❌ [Social Posts] Error fetching data:', error)
        setSocialPostData([])
        setFilteredData([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [refreshTrigger])

  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError('')
        setSuccess('')
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [error, success])

  useEffect(() => {
    let filtered = [...socialPostData]

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.publication.toLowerCase().includes(searchTerm)
      )
    }

    // Genre filter (if needed - genres might not be in the data, so this is a placeholder)
    // The actual filtering would depend on the data structure

    setFilteredData(filtered)
  }, [socialPostData, searchTerm, selectedGenres])

  const refreshData = async () => {
    try {
      const { authenticatedFetch } = await import('@/lib/authenticated-fetch')
      const response = await authenticatedFetch('/api/social-posts')
      if (!response.ok) throw new Error(`Failed to refresh: ${response.status}`)
      const responseData = await response.json()
      let data = responseData
      if (responseData && typeof responseData === 'object' && 'data' in responseData) {
        data = responseData.data
        setPriceAdjustments(responseData.priceAdjustments)
      }
      if (Array.isArray(data)) {
        setSocialPostData(data)
      }
    } catch (error: any) {
      setError('Failed to refresh data')
    }
  }

  const handleAddRecord = async (formData: any) => {
    try {
      const { authenticatedFetch } = await import('@/lib/authenticated-fetch')
      const response = await authenticatedFetch('/api/social-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to add record')
      }
      setSuccess('Record added successfully!')
      setShowAddModal(false)
      await refreshData()
    } catch (error: any) {
      setError(error.message || 'Failed to add record')
    }
  }

  const handleEditRecord = async (formData: any) => {
    if (!editingRecord?.id) {
      setError('No record selected for editing')
      return
    }
    try {
      const { authenticatedFetch } = await import('@/lib/authenticated-fetch')
      const response = await authenticatedFetch('/api/social-posts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, id: editingRecord.id }),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update record')
      }
      setSuccess('Record updated successfully!')
      setEditingRecord(null)
      await refreshData()
    } catch (error: any) {
      setError(error.message || 'Failed to update record')
    }
  }

  const handleDeleteRecord = async (recordId: string) => {
    if (!recordId) {
      console.error('❌ [Social Posts] No record ID provided for deletion')
      setError('No record ID found. Cannot delete.')
      return
    }
    
    if (!confirm('Are you sure you want to delete this record? This action cannot be undone.')) return
    
    try {
      setDeletingRecordId(recordId)
      console.log('🗑️ [Social Posts] Deleting record with ID:', recordId)
      const { authenticatedFetch } = await import('@/lib/authenticated-fetch')
      const response = await authenticatedFetch(`/api/social-posts?id=${encodeURIComponent(recordId)}`, { method: 'DELETE' })
      
      if (!response.ok) {
        const errorData = await response.json()
        console.error('❌ [Social Posts] Delete failed:', errorData)
        throw new Error(errorData.error || 'Failed to delete record')
      }
      
      const result = await response.json()
      console.log('✅ [Social Posts] Delete successful:', result)
      setSuccess('Record deleted successfully!')
      await refreshData()
    } catch (error: any) {
      console.error('❌ [Social Posts] Error deleting record:', error)
      setError(error.message || 'Failed to delete record')
    } finally {
      setDeletingRecordId(null)
    }
  }

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value.toLowerCase()
    setSearchTerm(term)
  }

  const toggleGenre = (genre: string) => {
    const newGenres = selectedGenres.includes(genre)
      ? selectedGenres.filter((g: string) => g !== genre)
      : [...selectedGenres, genre]
    setSelectedGenres(newGenres)
  }

  const getPlatformIcon = (platform: string) => {
    const platformIcons: Record<string, string> = {
      'Facebook': 'https://cdn.sanity.io/images/8n90kyzz/production/478252e94effa03caeb8759f2a5f40938fb5b3d3-1200x800.svg?w=10',
      'Instagram': 'https://cdn.sanity.io/images/8n90kyzz/production/ad755fccd4ed7eafde0a77e27556952d4949204b-1200x800.svg?w=10',
      'X': 'https://cdn.sanity.io/images/8n90kyzz/production/a002aba577475d991605dc6023426579fedd6b99-240x240.svg?w=10',
      'LinkedIn': 'https://cdn.sanity.io/images/8n90kyzz/production/965cf7110a8eff2e9f615fa05238ed94ac4a57d4-1200x800.svg?w=10',
    }
    return platformIcons[platform] || ''
  }

  if (isLoading) {
    return (
      <div className="opacity-100">
        <div className="flex items-center justify-center p-8">
          <p className="text-gray-500">Loading social posts...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="opacity-100">
      {error && <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">{success}</div>}
      <div className="flex lg:space-x-4 flex-col lg:flex-row">
        <aside className="font-body mt-2 space-y-4 bg-white border p-4 lg:border-none lg:p-0 lg:bg-transparent w-full lg:w-[550px]">
          <div className="sticky space-y-2 top-5">
            <div className="space-y-1">
              <p className="text-sm">Publication name</p>
              <input
                type="text"
                className="text-sm w-full p-2 placeholder:text-gray-400 placeholder:font-base border-2 bg-white"
                placeholder="Search publication name"
                value={searchTerm}
                onChange={handleSearch}
              />
            </div>
            {isAdmin && (
              <div className="pt-4 border-t">
                <button onClick={() => setShowAddModal(true)} className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">Add New Record</button>
              </div>
            )}
            <div className="space-y-1">
              <p className="text-sm">Select genres</p>
              <div className="flex flex-wrap gap-1">
                {genres.map((genre) => (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => toggleGenre(genre)}
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
            <p className="text-sm">
              All of the services listed on this page only include a social post and not an article.
            </p>
          </div>
        </aside>

        <section className="w-full mt-2 lg:pl-[120px]">
          <div>
            <div className="flex items-end">
              <h2 className="text-[24px] mr-[16px]">Social Post</h2>
              <p className="font-body text-sm mb-1">
                SHOWING {filteredData.length} OF {socialPostData.length} PUBLICATIONS
              </p>
            </div>
            <div className="overflow-x-scroll lg:overflow-visible relative">
              <table className="w-full divide-y divide-gray-300 overflow-hidden lg:overflow-visible border bg-white">
                <thead className="text-xs text-gray-700 bg-white sticky -top-1 shadow-sm">
                  <tr className="text-primary">
                    <th className="font-body font-medium border-l border-r uppercase p-2 px-2">
                      <div className="flex">Publication Name</div>
                    </th>
                    <th className="font-body font-medium border-l border-r uppercase p-2 px-2">
                      <div className="flex justify-center">Platform</div>
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
                        TAT
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
                  {filteredData.length === 0 && !isLoading ? (
                    <tr>
                      <td colSpan={isAdmin ? 6 : 5} className="text-center py-8 text-gray-500">No social posts available</td>
                    </tr>
                  ) : (
                    filteredData.map((item, index) => {
                      // Debug: Log item data to verify ID
                      if (index === 0) {
                        console.log('🔍 [Social Posts] Sample item data:', { id: item.id, publication: item.publication, hasId: !!item.id })
                      }
                      return (
                    <tr key={item.id || index} className="text-sm">
                      <td className="py-2 px-2">
                        <div className="flex items-center space-x-3">
                          {item.image && (() => {
                            let imageUrl: string
                            
                            if (typeof item.image === 'string') {
                              try {
                                // Try parsing as JSON string (Supabase/Sanity metadata)
                                const parsed = JSON.parse(item.image)
                                if (parsed && typeof parsed === 'object') {
                                  // It's a stringified object
                                  if (parsed.asset?._metadata?.isSupabaseUpload && parsed.asset._metadata.storagePath) {
                                    // Supabase storage upload - construct URL dynamically
                                    const { data: { publicUrl } } = supabase.storage
                                      .from('publications')
                                      .getPublicUrl(parsed.asset._metadata.storagePath)
                                    imageUrl = publicUrl
                                  } else if (parsed.asset?._ref) {
                                    // Legacy Sanity format
                                    const ref = parsed.asset._ref.replace('image-', '')
                                    imageUrl = `https://cdn.sanity.io/images/8n90kyzz/production/${ref.replace(/-png$/, '.png').replace(/-jpg$/, '.jpg').replace(/-jpeg$/, '.jpeg').replace(/-webp$/, '.webp')}?w=80&h=80&fit=crop&auto=format&q=75`
                                  } else {
                                    // Fallback
                                    imageUrl = `https://pricing.ascendagency.com${item.image.replace(/&amp;/g, '&')}`
                                  }
                                } else {
                                  // Not an object, use as URL
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
                              imageUrl = `https://pricing.ascendagency.com${(item.image as string | null)?.replace(/&amp;/g, '&') || ''}`
                            }
                            
                            return (
                              <div className="inline-flex w-10 h-10">
                                <img
                                  alt={`${item.publication} image`}
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
                          <div>
                            <div className="flex items-center">
                              {item.url ? (
                                <a
                                  href={item.url}
                                  className="flex items-center group"
                                  rel="noopener noreferrer nofollow"
                                  target="_blank"
                                >
                                  {item.publication}
                                </a>
                              ) : (
                                <span>{item.publication}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="text-center border-l border-r">
                        <div className="flex justify-center">
                          {item.platforms.map((platform, pIndex) => {
                            const iconUrl = getPlatformIcon(platform)
                            return iconUrl ? (
                              <img
                                key={pIndex}
                                alt={platform}
                                src={iconUrl}
                                className="w-10 h-10 object-cover rounded-full cursor-pointer"
                                loading="lazy"
                              />
                            ) : (
                              <span key={pIndex} className="text-xs">{platform}</span>
                            )
                          })}
                        </div>
                      </td>
                      <td className="text-center border-l border-r">
                        {isPriceAdjusted(item.price, priceAdjustments) ? (
                          <span className="relative group">
                            <span className="text-blue-600 font-medium">{item.price || 'N/A'}</span>
                            <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{getAdjustmentInfo(priceAdjustments)}</span>
                          </span>
                        ) : (
                          item.price || 'N/A'
                        )}
                      </td>
                      <td className="text-center border-l border-r">{item.tat}</td>
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
                      {isAdmin && (
                        <td className="text-center border-l border-r py-2 px-2">
                          <div className="flex justify-center space-x-2">
                            <button onClick={() => setEditingRecord(item)} className="text-blue-600 hover:text-blue-800 text-xs px-2 py-1 border border-blue-600 rounded hover:bg-blue-50">Edit</button>
                            <button 
                              onClick={() => {
                                if (item.id) {
                                  handleDeleteRecord(item.id)
                                } else {
                                  console.error('❌ [Social Posts] Cannot delete: Record missing ID', item)
                                  setError('Cannot delete: Record ID is missing')
                                }
                              }} 
                              disabled={deletingRecordId === item.id || !item.id} 
                              className="text-red-600 hover:text-red-800 text-xs px-2 py-1 border border-red-600 rounded hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {deletingRecordId === item.id ? 'Deleting...' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                    )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <br />
          <br />
          <div>
            <div className="flex items-end">
              <h2 className="text-[24px] mr-[16px]">Social Story</h2>
              <p className="font-body text-sm mb-1">SHOWING 0 OF 0 PUBLICATIONS</p>
            </div>
            <div className="overflow-x-scroll lg:overflow-visible relative">
              <table className="w-full divide-y divide-gray-300 overflow-hidden lg:overflow-visible border bg-white">
                <thead className="text-xs text-gray-700 bg-white sticky -top-1 shadow-sm">
                  <tr className="text-primary">
                    <th className="font-body font-medium border-l border-r uppercase p-2 px-2">
                      <div className="flex">Publication Name</div>
                    </th>
                    <th className="font-body font-medium border-l border-r uppercase p-2 px-2">
                      <div className="flex justify-center">Platform</div>
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
                        TAT
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {/* Empty - no social stories */}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
      {showAddModal && <AddSocialPostForm onClose={() => setShowAddModal(false)} onSubmit={handleAddRecord} error={error} success={success} />}
      {editingRecord && <AddSocialPostForm onClose={() => setEditingRecord(null)} onSubmit={handleEditRecord} error={error} success={success} initialData={editingRecord} isEditMode={true} />}
    </div>
  )
}

