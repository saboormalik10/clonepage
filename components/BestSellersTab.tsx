'use client'

import { useState, useEffect } from 'react'
import { useUserId } from '@/hooks/useUserId'
import { isPriceAdjusted, getAdjustmentInfo, hasActiveAdjustments } from '@/lib/price-adjustment-utils'

interface BestSeller {
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
  niches: string
}

export default function BestSellersTab() {
  const [bestSellersData, setBestSellersData] = useState<BestSeller[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredData, setFilteredData] = useState<BestSeller[]>([])
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [hoveredColumn, setHoveredColumn] = useState<'example' | 'regions' | 'genres' | null>(null)
  const [hoveredNicheIcon, setHoveredNicheIcon] = useState<{index: number, niche: string} | null>(null)
  const [priceAdjustments, setPriceAdjustments] = useState<any>(null)

  const userId = useUserId()

  useEffect(() => {
    let isMounted = true
    
    const fetchData = async () => {
      try {
        setIsLoading(true)
        const { authenticatedFetch } = await import('@/lib/authenticated-fetch')
        const response = await authenticatedFetch('/api/best-sellers')
        
        if (!isMounted) return
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
          console.error('❌ [Best Sellers] API error:', response.status, errorData)
          if (response.status === 401) {
            console.error('❌ [Best Sellers] Authentication failed - redirecting to login')
            window.location.href = '/login'
            return
          }
          throw new Error(`API error: ${response.status}`)
        }
        
        const responseData = await response.json()
        
        if (!isMounted) return
        
        // Handle new response format with data and priceAdjustments
        let data = responseData
        if (responseData && typeof responseData === 'object' && 'data' in responseData) {
          data = responseData.data
          setPriceAdjustments(responseData.priceAdjustments)
        }
        
        if (Array.isArray(data)) {
          setBestSellersData(data)
          setFilteredData(data)
        } else {
          console.warn('⚠️ [Best Sellers] Unexpected data format:', data)
          setBestSellersData([])
          setFilteredData([])
        }
      } catch (error) {
        console.error('Error fetching best sellers:', error)
        if (isMounted) {
          setBestSellersData([])
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
    
    // Parse string like "Health: $75, CBD: $75, Crypto: $75"
    const parts = nichesString.split(', ')
    parts.forEach(part => {
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
        }
      }
    })
    
    // Add non-accepted niches (those not in the string)
    Object.keys(nicheMap).forEach(nicheName => {
      if (!nicheData.find(n => n.name === nicheName)) {
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
          <p className="font-body text-sm mb-1">
            SHOWING {filteredData.length} OF {bestSellersData.length} PUBLICATIONS
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
                  <th className="font-body font-medium border-l border-r uppercase p-2 px-2">
                    <div className="flex justify-center">Niches</div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredData.map((item, index) => (
                  <tr key={index} className="text-sm">
                    <td className="py-2 px-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {item.image && (
                            <div className="inline-flex w-10 h-10">
                              <img
                                alt={`${item.publication || 'Publication'} image`}
                                src={`https://pricing.ascendagency.com${item.image.replace(/&amp;/g, '&')}`}
                                className="w-10 h-10 object-cover rounded-full"
                                loading="lazy"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement
                                  target.style.display = 'none'
                                }}
                              />
                            </div>
                          )}
                          <p>{item.publication || 'N/A'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-center border-l border-r">
                      {formatGenres(item.genres, index)}
                    </td>
                    <td className="text-center border-l border-r">{item.price}</td>
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

