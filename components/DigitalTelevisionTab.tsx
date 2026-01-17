'use client'

import { useState, useEffect } from 'react'
import { useUserId } from '@/hooks/useUserId'
import { useIsAdmin } from '@/hooks/useIsAdmin'
import { useVisibilityChange } from '@/hooks/useVisibilityChange'
import { isPriceAdjusted, getAdjustmentInfo, hasActiveAdjustments, getUserAdjustmentInfo } from '@/lib/price-adjustment-utils'
import AddDigitalTVForm from './AddDigitalTVForm'

interface DigitalTV {
  id?: string
  callSign: string
  station: string
  rate: string
  tat: string
  sponsored: string
  indexed: string
  segmentLength: string
  location: string
  programName: string
  interviewType: string
  exampleUrl: string
}

export default function DigitalTelevisionTab() {
  const [digitalTvData, setDigitalTvData] = useState<DigitalTV[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredData, setFilteredData] = useState<DigitalTV[]>([])
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [hoveredColumn, setHoveredColumn] = useState<'example' | null>(null)
  const [priceAdjustments, setPriceAdjustments] = useState<any>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingRecord, setEditingRecord] = useState<DigitalTV | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null)

  const userId = useUserId()
  const isAdmin = useIsAdmin()
  const { refreshTrigger } = useVisibilityChange()

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Only show loading on initial load, not on refreshes
        if (!hasLoaded) {
          setIsLoading(true)
        }
        console.log('🔍 [Digital TV] Starting fetch...')
        const { authenticatedFetch } = await import('@/lib/authenticated-fetch')
        const response = await authenticatedFetch('/api/digital-tv')
        
        console.log('📡 [Digital TV] Response status:', response.status, response.ok)
        
        if (!response.ok) {
          let errorData
          try {
            errorData = await response.json()
          } catch (e) {
            errorData = { error: `HTTP ${response.status}: ${response.statusText || 'Unknown error'}` }
          }
          console.error('❌ [Digital TV] API error:', response.status, errorData)
          if (response.status === 401) {
            console.error('❌ [Digital TV] Authentication failed - checking localStorage...')
            const { shouldRedirectToLogin } = await import('@/lib/authenticated-fetch')
            if (shouldRedirectToLogin()) {
              window.location.href = '/login'
              return
            } else {
              console.log('✅ [Digital TV] Valid localStorage session, continuing...')
              setDigitalTvData([])
              setFilteredData([])
              setIsLoading(false)
              return
            }
          }
          throw new Error(`API error: ${response.status} - ${errorData.error || 'Unknown error'}`)
        }
        
        const responseData = await response.json()
        console.log('✅ [Digital TV] Data received:', responseData)
        
        // Handle new response format with data and priceAdjustments
        let data = responseData
        if (responseData && typeof responseData === 'object' && 'data' in responseData) {
          data = responseData.data
          setPriceAdjustments(responseData.priceAdjustments)
        }
        
        if (Array.isArray(data)) {
          setDigitalTvData(data)
          setFilteredData(data)
          setHasLoaded(true)
        } else {
          console.warn('⚠️ [Digital TV] Unexpected data format:', data)
          setDigitalTvData([])
          setFilteredData([])
          setHasLoaded(true)
        }
      } catch (error: any) {
        console.error('❌ [Digital TV] Error fetching data:', error)
        console.error('   Error details:', error.message)
        setDigitalTvData([])
        setFilteredData([])
        setHasLoaded(true)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [refreshTrigger, hasLoaded]) // Re-fetch when tab becomes visible

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value.toLowerCase()
    setSearchTerm(term)
    const filtered = digitalTvData.filter(
      (tv) =>
        tv.callSign.toLowerCase().includes(term) ||
        tv.station.toLowerCase().includes(term) ||
        tv.programName.toLowerCase().includes(term)
    )
    setFilteredData(filtered)
  }

  // Clear messages after 3 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError('')
        setSuccess('')
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [error, success])

  const refreshData = async () => {
    try {
      console.log('🔄 [Digital TV] Refreshing data...')
      const { authenticatedFetch } = await import('@/lib/authenticated-fetch')
      const response = await authenticatedFetch('/api/digital-tv')
      
      if (!response.ok) {
        throw new Error(`Failed to refresh data: ${response.status}`)
      }
      
      const responseData = await response.json()
      let data = responseData
      if (responseData && typeof responseData === 'object' && 'data' in responseData) {
        data = responseData.data
        setPriceAdjustments(responseData.priceAdjustments)
      }
      
      if (Array.isArray(data)) {
        setDigitalTvData(data)
        setFilteredData(data.filter(
          (tv) =>
            tv.callSign.toLowerCase().includes(searchTerm.toLowerCase()) ||
            tv.station.toLowerCase().includes(searchTerm.toLowerCase()) ||
            tv.programName.toLowerCase().includes(searchTerm.toLowerCase())
        ))
      }
    } catch (error: any) {
      console.error('❌ [Digital TV] Error refreshing data:', error)
      setError('Failed to refresh data')
    }
  }

  const handleAddRecord = async (formData: any) => {
    try {
      console.log('➕ [Digital TV] Adding new record:', formData)
      const { authenticatedFetch } = await import('@/lib/authenticated-fetch')
      const response = await authenticatedFetch('/api/digital-tv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to add record')
      }

      const result = await response.json()
      console.log('✅ [Digital TV] Record added successfully:', result)
      
      setSuccess('Record added successfully!')
      setShowAddModal(false)
      await refreshData()
    } catch (error: any) {
      console.error('❌ [Digital TV] Error adding record:', error)
      setError(error.message || 'Failed to add record')
    }
  }

  const handleEditRecord = async (formData: any) => {
    if (!editingRecord?.id) {
      setError('No record selected for editing')
      return
    }

    try {
      console.log('✏️ [Digital TV] Updating record:', formData)
      const { authenticatedFetch } = await import('@/lib/authenticated-fetch')
      const response = await authenticatedFetch('/api/digital-tv', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...formData, id: editingRecord.id }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update record')
      }

      const result = await response.json()
      console.log('✅ [Digital TV] Record updated successfully:', result)
      
      setSuccess('Record updated successfully!')
      setEditingRecord(null)
      await refreshData()
    } catch (error: any) {
      console.error('❌ [Digital TV] Error updating record:', error)
      setError(error.message || 'Failed to update record')
    }
  }

  const handleDeleteRecord = async (recordId: string) => {
    if (!confirm('Are you sure you want to delete this record? This action cannot be undone.')) {
      return
    }

    try {
      setDeletingRecordId(recordId)
      console.log('🗑️ [Digital TV] Deleting record:', recordId)
      const { authenticatedFetch } = await import('@/lib/authenticated-fetch')
      const response = await authenticatedFetch(`/api/digital-tv?id=${recordId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete record')
      }

      const result = await response.json()
      console.log('✅ [Digital TV] Record deleted successfully:', result)
      
      setSuccess('Record deleted successfully!')
      await refreshData()
    } catch (error: any) {
      console.error('❌ [Digital TV] Error deleting record:', error)
      setError(error.message || 'Failed to delete record')
    } finally {
      setDeletingRecordId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="opacity-100">
        <div className="flex items-center justify-center p-8">
          <p className="text-charcoal-400">Loading digital TV data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="opacity-100">
      {/* Error/Success Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 text-red-400 rounded">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-900/30 border border-green-500/50 text-green-400 rounded">
          {success}
        </div>
      )}

      <div className="flex lg:space-x-4 flex-col lg:flex-row">
        <aside className="font-body mt-2 space-y-4 bg-gradient-to-br from-charcoal-900 to-black-soft border border-charcoal-700 p-4 lg:p-4 w-full lg:w-[350px] relative">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-gold-400 via-gold-500 to-gold-400"></div>
          <div className="sticky space-y-4 top-5">
            <div className="space-y-2">
              <p className="text-xs font-semibold tracking-wider uppercase text-gold-400">Call Sign</p>
              <input
                type="text"
                className="text-sm w-full p-3 placeholder:text-charcoal-500 border border-charcoal-600 bg-charcoal-800 text-champagne focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400/30 transition-all duration-300"
                placeholder="Search TV name"
                value={searchTerm}
                onChange={handleSearch}
              />
            </div>
            
            {/* Admin Controls */}
            {isAdmin && (
              <div className="pt-4 border-t border-charcoal-700 space-y-2">
                <button
                  onClick={() => setShowAddModal(true)}
                  className="w-full bg-gradient-to-r from-gold-400 via-gold-500 to-gold-400 text-black-pure px-4 py-2.5 font-ui text-xs font-semibold tracking-wider uppercase hover:shadow-[0_6px_25px_rgba(212,175,55,0.7)] transition-all duration-300"
                >
                  Add New Record
                </button>
              </div>
            )}
          </div>
        </aside>

        <section className="w-full mt-2">
          <p className="font-ui text-xs tracking-wider uppercase text-charcoal-400 mb-4">
            Showing <span className="text-gold-400">{filteredData.length}</span> of <span className="text-gold-400">{digitalTvData.length}</span> TVs
          </p>
          <div className="overflow-x-auto overscroll-x-contain relative bg-gradient-to-br from-charcoal-900 to-black-soft border border-charcoal-700">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-gold-400 via-gold-500 to-gold-400 z-10"></div>
            <table className="w-full">
              <thead className="bg-charcoal-800 sticky -top-1">
                <tr>
                  <th className="font-ui text-xs font-semibold tracking-wider text-gold-400 border-b border-charcoal-600 uppercase p-3 px-3">
                    <div className="flex">Call Sign</div>
                  </th>
                  <th className="font-ui text-xs font-semibold tracking-wider text-gold-400 border-b border-charcoal-600 uppercase p-3 px-3">
                    <div className="flex justify-center">Station</div>
                  </th>
                  <th className="font-ui text-xs font-semibold tracking-wider text-gold-400 border-b border-charcoal-600 uppercase p-3 px-3">
                    <div className="flex flex-col items-center">
                      <span>Rate</span>
                      {hasActiveAdjustments(priceAdjustments) && !userId && (
                        <span className="text-xs font-normal text-gold-300 mt-1" title={getAdjustmentInfo(priceAdjustments)}>
                          (Adjusted)
                        </span>
                      )}
                    </div>
                  </th>
                  <th className="font-ui text-xs font-semibold tracking-wider text-gold-400 border-b border-charcoal-600 uppercase p-3 px-3">
                    <div className="flex justify-center">TAT</div>
                  </th>
                  <th className="font-ui text-xs font-semibold tracking-wider text-gold-400 border-b border-charcoal-600 uppercase p-3 px-3">
                    <div className="flex justify-center">Sponsored</div>
                  </th>
                  <th className="font-ui text-xs font-semibold tracking-wider text-gold-400 border-b border-charcoal-600 uppercase p-3 px-3">
                    <div className="flex justify-center">Indexed</div>
                  </th>
                  <th className="font-ui text-xs font-semibold tracking-wider text-gold-400 border-b border-charcoal-600 uppercase p-3 px-3">
                    <div className="flex justify-center">Segement Length</div>
                  </th>
                  <th className="font-ui text-xs font-semibold tracking-wider text-gold-400 border-b border-charcoal-600 uppercase p-3 px-3">
                    <div className="flex justify-center">Location</div>
                  </th>
                  <th className="font-ui text-xs font-semibold tracking-wider text-gold-400 border-b border-charcoal-600 uppercase p-3 px-3">
                    <div className="flex justify-center">Program Name</div>
                  </th>
                  <th className="font-ui text-xs font-semibold tracking-wider text-gold-400 border-b border-charcoal-600 uppercase p-3 px-3">
                    <div className="flex justify-center">Interview Type</div>
                  </th>
                  <th className="font-ui text-xs font-semibold tracking-wider text-gold-400 border-b border-charcoal-600 uppercase p-3 px-3">
                    <div className="flex justify-center">Example</div>
                  </th>
                  {isAdmin && (
                    <th className="font-ui text-xs font-semibold tracking-wider text-gold-400 border-b border-charcoal-600 uppercase p-3 px-3">
                      <div className="flex justify-center">Actions</div>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredData.length === 0 && !isLoading ? (
                  <tr>
                    <td colSpan={isAdmin ? 12 : 11} className="text-center py-8 text-charcoal-400">
                      No digital TV data available
                    </td>
                  </tr>
                ) : (
                  filteredData.map((tv, index) => (
                  <tr key={index} className="text-sm border-b border-charcoal-700 hover:bg-gold-400/5 transition-all duration-300">
                    <td className="text-center  text-ivory py-3">{tv.callSign}</td>
                    <td className="text-center  text-champagne">{tv.station}</td>
                    <td className="text-center ">
                      {getUserAdjustmentInfo(priceAdjustments) ? (
                        <span className="relative group">
                          <span className="text-gold-400 font-semibold">{tv.rate || 'N/A'}</span>
                          <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-champagne bg-charcoal-800 border border-charcoal-600 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            {getUserAdjustmentInfo(priceAdjustments)}
                          </span>
                        </span>
                      ) : (
                        <span className="text-gold-400 font-semibold">{tv.rate || 'N/A'}</span>
                      )}
                    </td>
                    <td className="text-center  text-champagne">{tv.tat}</td>
                    <td className="text-center  text-champagne">{tv.sponsored}</td>
                    <td className="text-center  text-champagne">{tv.indexed}</td>
                    <td className="text-center  text-champagne">{tv.segmentLength}</td>
                    <td className="text-center  text-champagne">{tv.location}</td>
                    <td className="text-center ">
                      <span className="text-xs font-medium mr-1 px-2.5 py-0.5 rounded bg-charcoal-700 text-champagne">
                        {tv.programName}
                      </span>
                    </td>
                    <td className="text-center  w-8 text-champagne">{tv.interviewType}</td>
                    <td className="text-center  relative">
                      {tv.exampleUrl && (
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
                            href={tv.exampleUrl}
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
                                  {tv.exampleUrl ? (
                                    <img 
                                      alt={`${tv.station} preview`}
                                      loading="lazy"
                                      width="250"
                                      height="200"
                                      decoding="async"
                                      fetchPriority="low"
                                      className="object-cover border"
                                      src={tv.exampleUrl.includes('?') ? `${tv.exampleUrl}&w=250&h=200&fit=crop&auto=format&q=80` : `${tv.exampleUrl}?w=250&h=200&fit=crop&auto=format&q=80`}
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
                      <td className="text-center  py-3 px-3">
                        <div className="flex justify-center space-x-2">
                          <button
                            onClick={() => setEditingRecord(tv)}
                            className="text-gold-400 hover:text-gold-300 text-xs px-3 py-1.5 border border-gold-400 hover:bg-gold-400/10 hover:shadow-[0_6px_25px_rgba(212,175,55,0.7)] transition-all duration-300"
                            title="Edit record"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => tv.id && handleDeleteRecord(tv.id)}
                            disabled={deletingRecordId === tv.id || !tv.id}
                            className="text-red-400 hover:text-red-300 text-xs px-3 py-1.5 border border-red-400 hover:bg-red-400/10 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Delete record"
                          >
                            {deletingRecordId === tv.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Add Record Modal */}
      {showAddModal && (
        <AddDigitalTVForm
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddRecord}
          error={error}
          success={success}
        />
      )}

      {/* Edit Record Modal */}
      {editingRecord && (
        <AddDigitalTVForm
          onClose={() => setEditingRecord(null)}
          onSubmit={handleEditRecord}
          error={error}
          success={success}
          initialData={editingRecord}
          isEditMode={true}
        />
      )}
    </div>
  )
}

