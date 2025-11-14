'use client'

import { useState, useEffect } from 'react'
import { useUserId } from '@/hooks/useUserId'
import { useVisibilityChange } from '@/hooks/useVisibilityChange'
import { isPriceAdjusted, getAdjustmentInfo, hasActiveAdjustments } from '@/lib/price-adjustment-utils'

interface TableRow {
  affiliate: string
  calls: string
  state: string
  market: string
  program: string
  location: string
  time: string
  rate: string
  exampleUrl: string
  intakeUrl: string
}

export default function BroadcastTelevisionTab() {
  const [tableData, setTableData] = useState<TableRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredData, setFilteredData] = useState<TableRow[]>([])
  const [priceAdjustments, setPriceAdjustments] = useState<any>(null)

  const userId = useUserId()
  const { refreshTrigger } = useVisibilityChange()

  useEffect(() => {
    let isMounted = true
    
    const fetchData = async () => {
      try {
        setIsLoading(true)
        console.log('🔍 [Broadcast TV] Starting fetch...')
        const { authenticatedFetch } = await import('@/lib/authenticated-fetch')
        const response = await authenticatedFetch('/api/broadcast-tv')
        
        console.log('📡 [Broadcast TV] Response status:', response.status, response.ok)
        
        if (!isMounted) return
        
        if (!response.ok) {
          let errorData
          try {
            errorData = await response.json()
          } catch (e) {
            errorData = { error: `HTTP ${response.status}: ${response.statusText || 'Unknown error'}` }
          }
          console.error('❌ [Broadcast TV] API error:', response.status, errorData)
          if (response.status === 401) {
            console.error('❌ [Broadcast TV] Authentication failed - redirecting to login')
            window.location.href = '/login'
            return
          }
          throw new Error(`API error: ${response.status} - ${errorData.error || 'Unknown error'}`)
        }
        
        const responseData = await response.json()
        console.log('✅ [Broadcast TV] Data received:', responseData)
        
        if (!isMounted) return
        
        // Handle new response format with data and priceAdjustments
        let data = responseData
        if (responseData && typeof responseData === 'object' && 'data' in responseData) {
          data = responseData.data
          setPriceAdjustments(responseData.priceAdjustments)
        }
        
        if (Array.isArray(data)) {
          setTableData(data)
          setFilteredData(data)
        } else {
          console.warn('⚠️ [Broadcast TV] Unexpected data format:', data)
          setTableData([])
          setFilteredData([])
        }
      } catch (error: any) {
        console.error('❌ [Broadcast TV] Error fetching data:', error)
        console.error('   Error details:', error.message)
        if (isMounted) {
          setTableData([])
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
  }, [refreshTrigger]) // Re-fetch when tab becomes visible

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value.toLowerCase()
    setSearchTerm(term)
    const filtered = tableData.filter(
      (row) =>
        row.affiliate.toLowerCase().includes(term) ||
        row.calls.toLowerCase().includes(term) ||
        row.market.toLowerCase().includes(term)
    )
    setFilteredData(filtered)
  }

  if (isLoading) {
    return (
      <div className="opacity-100">
        <div className="flex items-center justify-center p-8">
          <p className="text-gray-500">Loading broadcast TV data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="opacity-100">
      <div className="flex lg:space-x-4 flex-col lg:flex-row">
        <aside className="font-body mt-2 space-y-4 bg-white border p-4 lg:border-none lg:p-0 lg:bg-transparent w-full lg:w-[350px]">
          <div className="sticky space-y-2 top-5">
            <div className="space-y-1">
              <p className="text-sm">Affiliate name or calls</p>
              <input
                type="text"
                className="text-sm w-full p-2 placeholder:text-gray-400 placeholder:font-base border-2 bg-white"
                placeholder="Search TV name"
                value={searchTerm}
                onChange={handleSearch}
              />
            </div>
          </div>
          <ul className="text-sm text-gray-800 space-y-1">
            <li>Turn Around Time: 2-4 Weeks</li>
            <li>Segment Times vary between 2-4 minutes</li>
            <li>Zoom & In Person Options Available</li>
          </ul>
        </aside>
        <section className="w-full mt-2">
          <p className="font-body text-sm mb-1">
            Showing {filteredData.length} of {tableData.length} TVs
          </p>
          <div className="overflow-x-scroll lg:overflow-visible relative">
            <table className="w-full divide-y divide-gray-300 overflow-hidden lg:overflow-visible border bg-white">
              <thead className="text-xs text-gray-700 bg-white sticky -top-1 shadow-sm">
                <tr className="text-primary">
                  <th className="font-body font-medium border-l border-r uppercase p-2 px-2">
                    <div className="flex">Affiliate</div>
                  </th>
                  <th className="font-body font-medium border-l border-r uppercase p-2 px-2">
                    <div className="flex justify-center">Calls</div>
                  </th>
                  <th className="font-body font-medium border-l border-r uppercase p-2 px-2">
                    <div className="flex justify-center">State</div>
                  </th>
                  <th className="font-body font-medium border-l border-r uppercase p-2 px-2">
                    <div className="flex justify-center">Market</div>
                  </th>
                  <th className="font-body font-medium border-l border-r uppercase p-2 px-2">
                    <div className="flex justify-center">Program Name</div>
                  </th>
                  <th className="font-body font-medium border-l border-r uppercase p-2 px-2">
                    <div className="flex justify-center">Location</div>
                  </th>
                  <th className="font-body font-medium border-l border-r uppercase p-2 px-2">
                    <div className="flex justify-center">Time</div>
                  </th>
                  <th className="font-body font-medium border-l border-r uppercase p-2 px-2">
                    <div className="flex flex-col items-center">
                      <span>Rate</span>
                      {hasActiveAdjustments(priceAdjustments) && (
                        <span className="text-xs font-normal text-blue-600 mt-1" title={getAdjustmentInfo(priceAdjustments)}>
                          (Adjusted)
                        </span>
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredData.map((row, index) => (
                  <tr key={index} className="text-sm">
                    <td className="py-2 px-2">
                      <div className="flex items-center space-x-3">
                        <div>
                          <p>{row.affiliate}</p>
                          {row.exampleUrl && (
                            <a
                              href={row.exampleUrl}
                              className="underline flex items-center group"
                              rel="noopener noreferrer nofollow"
                              target="_blank"
                            >
                              Example
                              <svg
                                width="15"
                                height="15"
                                viewBox="0 0 15 15"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                className="ml-1 group-hover:translate-x-1 group-hover:text-primary group-hover:-translate-y-0.5 group-hover:duration-500 duration-300"
                              >
                                <path
                                  fillRule="evenodd"
                                  clipRule="evenodd"
                                  d="M12 13C12.5523 13 13 12.5523 13 12V3C13 2.44771 12.5523 2 12 2H3C2.44771 2 2 2.44771 2 3V6.5C2 6.77614 2.22386 7 2.5 7C2.77614 7 3 6.77614 3 6.5V3H12V12H8.5C8.22386 12 8 12.2239 8 12.5C8 12.7761 8.22386 13 8.5 13H12ZM9 6.5C9 6.5001 9 6.50021 9 6.50031V6.50035V9.5C9 9.77614 8.77614 10 8.5 10C8.22386 10 8 9.77614 8 9.5V7.70711L2.85355 12.8536C2.65829 13.0488 2.34171 13.0488 2.14645 12.8536C1.95118 12.6583 1.95118 12.3417 2.14645 12.1464L7.29289 7H5.5C5.22386 7 5 6.77614 5 6.5C5 6.22386 5.22386 6 5.5 6H8.5C8.56779 6 8.63244 6.01349 8.69139 6.03794C8.74949 6.06198 8.80398 6.09744 8.85143 6.14433C8.94251 6.23434 8.9992 6.35909 8.99999 6.49708L8.99999 6.49738"
                                  fill="currentColor"
                                />
                              </svg>
                            </a>
                          )}
                          {row.intakeUrl && (
                            <a
                              href={row.intakeUrl}
                              className="flex items-center group text-xs font-body p-[3px] bg-primary text-white hover:bg-primary/20 hover:text-primary mt-1"
                              rel="noopener noreferrer nofollow"
                              target="_blank"
                            >
                              <svg
                                width="15"
                                height="15"
                                viewBox="0 0 15 15"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path
                                  d="M4.2 1H4.17741H4.1774C3.86936 0.999988 3.60368 0.999978 3.38609 1.02067C3.15576 1.04257 2.92825 1.09113 2.71625 1.22104C2.51442 1.34472 2.34473 1.51442 2.22104 1.71625C2.09113 1.92825 2.04257 2.15576 2.02067 2.38609C1.99998 2.60367 1.99999 2.86935 2 3.17738V3.1774V3.2V11.8V11.8226V11.8226C1.99999 12.1307 1.99998 12.3963 2.02067 12.6139C2.04257 12.8442 2.09113 13.0717 2.22104 13.2837C2.34473 13.4856 2.51442 13.6553 2.71625 13.779C2.92825 13.9089 3.15576 13.9574 3.38609 13.9793C3.60368 14 3.86937 14 4.17741 14H4.2H10.8H10.8226C11.1306 14 11.3963 14 11.6139 13.9793C11.8442 13.9574 12.0717 13.9089 12.2837 13.779C12.4856 13.6553 12.6553 13.4856 12.779 13.2837C12.9089 13.0717 12.9574 12.8442 12.9793 12.6139C13 12.3963 13 12.1306 13 11.8226V11.8V3.2V3.17741C13 2.86936 13 2.60368 12.9793 2.38609C12.9574 2.15576 12.9089 1.92825 12.779 1.71625C12.6553 1.51442 12.4856 1.34472 12.2837 1.22104C12.0717 1.09113 11.8442 1.04257 11.6139 1.02067C11.3963 0.999978 11.1306 0.999988 10.8226 1H10.8H4.2ZM3.23875 2.07368C3.26722 2.05623 3.32362 2.03112 3.48075 2.01618C3.64532 2.00053 3.86298 2 4.2 2H10.8C11.137 2 11.3547 2.00053 11.5193 2.01618C11.6764 2.03112 11.7328 2.05623 11.7613 2.07368C11.8285 2.11491 11.8851 2.17147 11.9263 2.23875C11.9438 2.26722 11.9689 2.32362 11.9838 2.48075C11.9995 2.64532 12 2.86298 12 3.2V11.8C12 12.137 11.9995 12.3547 11.9838 12.5193C11.9689 12.6764 11.9438 12.7328 11.9263 12.7613C11.8851 12.8285 11.8285 12.8851 11.7613 12.9263C11.7328 12.9438 11.6764 12.9689 11.5193 12.9838C11.3547 12.9995 11.137 13 10.8 13H4.2C3.86298 13 3.64532 12.9995 3.48075 12.9838C3.32362 12.9689 3.26722 12.9438 3.23875 12.9263C3.17147 12.8851 3.11491 12.8285 3.07368 12.7613C3.05624 12.7328 3.03112 12.6764 3.01618 12.5193C3.00053 12.3547 3 12.137 3 11.8V3.2C3 2.86298 3.00053 2.64532 3.01618 2.48075C3.03112 2.32362 3.05624 2.26722 3.07368 2.23875C3.11491 2.17147 3.17147 2.11491 3.23875 2.07368ZM5 10C4.72386 10 4.5 10.2239 4.5 10.5C4.5 10.7761 4.72386 11 5 11H8C8.27614 11 8.5 10.7761 8.5 10.5C8.5 10.2239 8.27614 10 8 10H5ZM4.5 7.5C4.5 7.22386 4.72386 7 5 7H10C10.2761 7 10.5 7.22386 10.5 7.5C10.5 7.77614 10.2761 8 10 8H5C4.72386 8 4.5 7.77614 4.5 7.5ZM5 4C4.72386 4 4.5 4.22386 4.5 4.5C4.5 4.77614 4.72386 5 5 5H10C10.2761 5 10.5 4.77614 10.5 4.5C10.5 4.22386 10.2761 4 10 4H5Z"
                                  fill="currentColor"
                                  fillRule="evenodd"
                                  clipRule="evenodd"
                                />
                              </svg>
                              Intake form
                            </a>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="text-center border-l border-r">{row.calls}</td>
                    <td className="text-center border-l border-r">{row.state}</td>
                    <td className="text-center border-l border-r">{row.market}</td>
                    <td className="text-center border-l border-r">{row.program}</td>
                    <td className="text-center border-l border-r">
                      <span className="text-xs font-medium mr-1 px-2.5 py-0.5 rounded bg-gray-100 text-gray-800">
                        {row.location}
                      </span>
                    </td>
                    <td className="text-center border-l border-r">{row.time}</td>
                    <td className="text-center border-l border-r w-8">
                      <button className="inline-flex items-center justify-center" data-state="closed">
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 15 15"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M0.877075 7.49972C0.877075 3.84204 3.84222 0.876892 7.49991 0.876892C11.1576 0.876892 14.1227 3.84204 14.1227 7.49972C14.1227 11.1574 11.1576 14.1226 7.49991 14.1226C3.84222 14.1226 0.877075 11.1574 0.877075 7.49972ZM7.49991 1.82689C4.36689 1.82689 1.82708 4.36671 1.82708 7.49972C1.82708 10.6327 4.36689 13.1726 7.49991 13.1726C10.6329 13.1726 13.1727 10.6327 13.1727 7.49972C13.1727 4.36671 10.6329 1.82689 7.49991 1.82689ZM8.24993 10.5C8.24993 10.9142 7.91414 11.25 7.49993 11.25C7.08571 11.25 6.74993 10.9142 6.74993 10.5C6.74993 10.0858 7.08571 9.75 7.49993 9.75C7.91414 9.75 8.24993 10.0858 8.24993 10.5ZM6.05003 6.25C6.05003 5.57211 6.63511 4.925 7.50003 4.925C8.36496 4.925 8.95003 5.57211 8.95003 6.25C8.95003 6.74118 8.68002 6.99212 8.21447 7.27494C8.16251 7.30651 8.10258 7.34131 8.03847 7.37854L8.03841 7.37858C7.85521 7.48497 7.63788 7.61119 7.47449 7.73849C7.23214 7.92732 6.95003 8.23198 6.95003 8.7C6.95004 9.00376 7.19628 9.25 7.50004 9.25C7.8024 9.25 8.04778 9.00601 8.05002 8.70417L8.05056 8.7033C8.05924 8.6896 8.08493 8.65735 8.15058 8.6062C8.25207 8.52712 8.36508 8.46163 8.51567 8.37436L8.51571 8.37433C8.59422 8.32883 8.68296 8.27741 8.78559 8.21506C9.32004 7.89038 10.05 7.35382 10.05 6.25C10.05 4.92789 8.93511 3.825 7.50003 3.825C6.06496 3.825 4.95003 4.92789 4.95003 6.25C4.95003 6.55376 5.19628 6.8 5.50003 6.8C5.80379 6.8 6.05003 6.55376 6.05003 6.25Z"
                            fill="currentColor"
                            fillRule="evenodd"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </td>
                    <td className="text-center border-l border-r">{row.rate || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}

