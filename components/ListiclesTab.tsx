'use client'

import { useState, useEffect } from 'react'
import { useUserId } from '@/hooks/useUserId'
import { isPriceAdjusted, getAdjustmentInfo, hasActiveAdjustments } from '@/lib/price-adjustment-utils'

interface Listicle {
  publication: string
  image: string
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

  const userId = useUserId()

  useEffect(() => {
    let isMounted = true
    
    const fetchData = async () => {
      try {
        setIsLoading(true)
        console.log('🔍 [Listicles] Starting fetch...')
        const { authenticatedFetch } = await import('@/lib/authenticated-fetch')
        const response = await authenticatedFetch('/api/listicles')
        
        console.log('📡 [Listicles] Response status:', response.status, response.ok)
        
        if (!isMounted) return
        
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
        
        if (!isMounted) return
        
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
        if (isMounted) {
          setListiclesData([])
          setFilteredData([])
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
  }, []) // Empty dependency array - fetch only once on mount

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
    
    // Match pattern: "Top X : $Y" where X is a number and Y is a price
    const regex = /Top\s+(\d+)\s*:\s*(\$[\d,]+)/g
    const matches = []
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
          <p className="font-body text-sm mb-1">
            SHOWING {filteredData.length} OF {listiclesData.length} PUBLICATIONS
          </p>
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
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredData.map((listicle, index) => (
                  <tr key={index} className="text-sm">
                    <td className="py-2 px-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {listicle.image && (
                            <div className="inline-flex w-10 h-10">
                              <img
                                alt={`${listicle.publication || 'Publication'} image`}
                                src={`https://pricing.ascendagency.com${listicle.image.replace(/&amp;/g, '&')}`}
                                className="w-10 h-10 object-cover rounded-full"
                                loading="lazy"
                                onError={(e) => {
                                  // Fallback if the image fails to load
                                  const target = e.target as HTMLImageElement
                                  target.style.display = 'none'
                                }}
                              />
                            </div>
                          )}
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
                      {listicle.exampleUrl && (
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

