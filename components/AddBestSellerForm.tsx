'use client'

import { useState, useCallback, useRef, useEffect, memo } from 'react'
import { createClient } from '@/lib/supabase-client'

interface Genre {
  name: string
}

interface Region {
  name: string
}

interface FormData {
  name: string
  domain_authority: number | null
  domain_rating: number | null
  estimated_time: string
  sponsored: string
  indexed: string
  do_follow: string
  example_url: string
  health: boolean
  cbd: boolean
  crypto: boolean
  gambling: boolean
  erotic: boolean
  defaultPrice: number[]
  genres: Genre[]
  regions: Region[]
  logo: any
  articlePreview: any
}

interface AddBestSellerFormProps {
  onClose: () => void
  onSubmit: (data: FormData) => Promise<void>
  error?: string
  success?: string
  initialData?: any // BestSeller data for edit mode
  isEditMode?: boolean
}

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

// Memoized input component to prevent re-renders
const DebouncedInput = memo(({ 
  value, 
  onChange, 
  ...props 
}: { 
  value: string | number | null
  onChange: (value: string | number | null) => void
  [key: string]: any
}) => {
  const [localValue, setLocalValue] = useState(value ?? '')
  const debouncedValue = useDebounce(localValue, 150)
  const isInitialMount = useRef(true)

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    setLocalValue(value ?? '')
  }, [value])

  useEffect(() => {
    if (debouncedValue !== value) {
      onChange(debouncedValue === '' ? null : debouncedValue)
    }
  }, [debouncedValue, onChange])

  return (
    <input
      {...props}
      value={localValue}
      onChange={(e) => {
        const newValue = props.type === 'number' 
          ? (e.target.value === '' ? null : parseFloat(e.target.value))
          : e.target.value
        setLocalValue(newValue ?? '')
      }}
    />
  )
})

DebouncedInput.displayName = 'DebouncedInput'

function AddBestSellerForm({ onClose, onSubmit, error, success, initialData, isEditMode = false }: AddBestSellerFormProps) {
  // Transform BestSeller data to FormData format
  const getInitialFormData = (): FormData => {
    if (initialData) {
      // Parse genres from comma-separated string
      const genres: Genre[] = initialData.genres
        ? initialData.genres.split(', ').map((g: string) => ({ name: g.trim() })).filter((g: Genre) => g.name)
        : []
      
      // Parse regions from comma-separated string
      const regions: Region[] = initialData.region
        ? initialData.region.split(', ').map((r: string) => ({ name: r.trim() })).filter((r: Region) => r.name)
        : []

      // Parse image if it's a stringified JSON
      let logo = initialData.image
      if (typeof logo === 'string') {
        try {
          const parsed = JSON.parse(logo)
          if (parsed && typeof parsed === 'object') {
            logo = parsed
          }
        } catch (e) {
          // If parsing fails, keep as string
        }
      }

      // Parse price from string format like "$75, $100" to array
      let defaultPrice: number[] = []
      if (initialData.price) {
        const priceMatches = initialData.price.match(/\$(\d+)/g)
        if (priceMatches) {
          defaultPrice = priceMatches.map((p: string) => parseFloat(p.replace('$', '')))
        }
      }

      // Parse niches from comma-separated string to boolean flags
      const nichesString = initialData.niches || ''
      const nichesArray = nichesString.split(', ').map((n: string) => n.trim())
      
      return {
        name: initialData.publication || '',
        domain_authority: initialData.da ? parseFloat(initialData.da) : null,
        domain_rating: initialData.dr ? parseFloat(initialData.dr) : null,
        estimated_time: initialData.tat || '',
        sponsored: initialData.sponsored || '',
        indexed: initialData.indexed || '',
        do_follow: initialData.dofollow || '',
        health: nichesArray.includes('Health'),
        cbd: nichesArray.includes('CBD'),
        crypto: nichesArray.includes('Crypto'),
        gambling: nichesArray.includes('Gambling'),
        erotic: nichesArray.includes('Erotic'),
        defaultPrice: defaultPrice,
        genres: genres,
        regions: regions,
        logo: logo,
        articlePreview: null,
        example_url: initialData.exampleUrl || initialData.example_url || '',
      }
    }
    return {
      name: '',
      domain_authority: null,
      domain_rating: null,
      estimated_time: '',
      sponsored: '',
      indexed: '',
      do_follow: '',
      health: false,
      cbd: false,
      crypto: false,
      gambling: false,
      erotic: false,
      defaultPrice: [],
      genres: [],
      regions: [],
      logo: null,
      articlePreview: null,
      example_url: '',
    }
  }

  const [formData, setFormData] = useState<FormData>(getInitialFormData())
  const [logoPreview, setLogoPreview] = useState<string | null>(initialData?.image ? (typeof initialData.image === 'object' ? null : initialData.image) : null)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [logoError, setLogoError] = useState('')
  const [fileInputKey, setFileInputKey] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  // Update form data when initialData changes (for edit mode)
  useEffect(() => {
    if (initialData) {
      // Parse genres from comma-separated string
      const genres: Genre[] = initialData.genres
        ? initialData.genres.split(', ').map((g: string) => ({ name: g.trim() })).filter((g: Genre) => g.name)
        : []
      
      // Parse regions from comma-separated string
      const regions: Region[] = initialData.region
        ? initialData.region.split(', ').map((r: string) => ({ name: r.trim() })).filter((r: Region) => r.name)
        : []

      // Parse image if it's a stringified JSON
      let logo = initialData.image
      if (typeof logo === 'string') {
        try {
          const parsed = JSON.parse(logo)
          if (parsed && typeof parsed === 'object') {
            logo = parsed
          }
        } catch (e) {
          // If parsing fails, keep as string
        }
      }

      // Parse price from string format like "$75, $100" to array
      let defaultPrice: number[] = []
      if (initialData.price) {
        const priceMatches = initialData.price.match(/\$(\d+)/g)
        if (priceMatches) {
          defaultPrice = priceMatches.map((p: string) => parseFloat(p.replace('$', '')))
        }
      }

      // Parse niches from comma-separated string to boolean flags
      const nichesString = initialData.niches || ''
      const nichesArray = nichesString.split(', ').map((n: string) => n.trim())

      const newFormData: FormData = {
        name: initialData.publication || '',
        domain_authority: initialData.da ? parseFloat(initialData.da) : null,
        domain_rating: initialData.dr ? parseFloat(initialData.dr) : null,
        estimated_time: initialData.tat || '',
        sponsored: initialData.sponsored || '',
        indexed: initialData.indexed || '',
        do_follow: initialData.dofollow || '',
        health: nichesArray.includes('Health'),
        cbd: nichesArray.includes('CBD'),
        crypto: nichesArray.includes('Crypto'),
        gambling: nichesArray.includes('Gambling'),
        erotic: nichesArray.includes('Erotic'),
        defaultPrice: defaultPrice,
        genres: genres,
        regions: regions,
        logo: logo,
        articlePreview: null,
        example_url: initialData.exampleUrl || initialData.example_url || '',
      }
      setFormData(newFormData)
      
      // Set logo preview
      if (initialData.image) {
        if (typeof initialData.image === 'string') {
          try {
            // Try parsing as JSON string
            const parsed = JSON.parse(initialData.image)
            if (parsed && typeof parsed === 'object') {
              // It's a stringified object
              if (parsed.asset?._metadata?.isSupabaseUpload && parsed.asset._metadata.storagePath) {
                // Supabase upload - get public URL
                const { data: { publicUrl } } = supabase.storage
                  .from('publications')
                  .getPublicUrl(parsed.asset._metadata.storagePath)
                setLogoPreview(publicUrl)
              } else if (parsed.asset?._ref) {
                // Legacy Sanity format - use Sanity CDN
                const ref = parsed.asset._ref.replace('image-', '')
                const imageUrl = `https://cdn.sanity.io/images/8n90kyzz/production/${ref.replace(/-png$/, '.png').replace(/-jpg$/, '.jpg').replace(/-jpeg$/, '.jpeg').replace(/-webp$/, '.webp')}?w=80&h=80&fit=crop&auto=format&q=75`
                setLogoPreview(imageUrl)
              } else {
                // Fallback to original string
                setLogoPreview(`https://pricing.ascendagency.com${initialData.image.replace(/&amp;/g, '&')}`)
              }
            } else {
              // Not an object, use as URL
              setLogoPreview(`https://pricing.ascendagency.com${initialData.image.replace(/&amp;/g, '&')}`)
            }
          } catch (e) {
            // Not JSON, treat as legacy string format
            setLogoPreview(`https://pricing.ascendagency.com${initialData.image.replace(/&amp;/g, '&')}`)
          }
        } else if (typeof initialData.image === 'object' && initialData.image !== null) {
          // Already an object
          const imageData = initialData.image as any
          if (imageData.asset?._metadata?.isSupabaseUpload && imageData.asset._metadata.storagePath) {
            // Supabase upload - get public URL
            const { data: { publicUrl } } = supabase.storage
              .from('publications')
              .getPublicUrl(imageData.asset._metadata.storagePath)
            setLogoPreview(publicUrl)
          } else if (imageData.asset?._ref) {
            // Legacy Sanity format - use Sanity CDN
            const ref = imageData.asset._ref.replace('image-', '')
            const imageUrl = `https://cdn.sanity.io/images/8n90kyzz/production/${ref.replace(/-png$/, '.png').replace(/-jpg$/, '.jpg').replace(/-jpeg$/, '.jpeg').replace(/-webp$/, '.webp')}?w=80&h=80&fit=crop&auto=format&q=75`
            setLogoPreview(imageUrl)
          } else {
            setLogoPreview(null)
          }
        } else {
          setLogoPreview(null)
        }
      } else {
        setLogoPreview(null)
      }
    } else {
      // Reset form for add mode
      setFormData({
        name: '',
        domain_authority: null,
        domain_rating: null,
        estimated_time: '',
        sponsored: '',
        indexed: '',
        do_follow: '',
        health: false,
        cbd: false,
        crypto: false,
        gambling: false,
        erotic: false,
        defaultPrice: [],
        genres: [],
        regions: [],
        logo: null,
        articlePreview: null,
        example_url: '',
      })
      setLogoPreview(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (isSubmitting) {
      console.log('⚠️ [AddBestSellerForm] Form is already submitting, ignoring...')
      return
    }

    setIsSubmitting(true)
    console.log('📝 [AddBestSellerForm] Form submitted with data:', formData)
    try {
      await onSubmit(formData)
    } catch (error) {
      console.error('❌ [AddBestSellerForm] Error in handleSubmit:', error)
    } finally {
      setIsSubmitting(false)
    }
  }, [formData, onSubmit, isSubmitting])

  const addGenre = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      genres: [...prev.genres, { name: '' }]
    }))
  }, [])

  const updateGenre = useCallback((index: number, field: keyof Genre, value: string) => {
    setFormData(prev => {
      const updatedGenres = [...prev.genres]
      updatedGenres[index] = { ...updatedGenres[index], [field]: value }
      return { ...prev, genres: updatedGenres }
    })
  }, [])

  const removeGenre = useCallback((index: number) => {
    setFormData(prev => ({
      ...prev,
      genres: prev.genres.filter((_, i) => i !== index)
    }))
  }, [])

  const addRegion = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      regions: [...prev.regions, { name: '' }]
    }))
  }, [])

  const updateRegion = useCallback((index: number, field: keyof Region, value: string) => {
    setFormData(prev => {
      const updatedRegions = [...prev.regions]
      updatedRegions[index] = { ...updatedRegions[index], [field]: value }
      return { ...prev, regions: updatedRegions }
    })
  }, [])

  const removeRegion = useCallback((index: number) => {
    setFormData(prev => ({
      ...prev,
      regions: prev.regions.filter((_, i) => i !== index)
    }))
  }, [])

  const addPrice = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      defaultPrice: [...prev.defaultPrice, 0]
    }))
  }, [])

  const updatePrice = useCallback((index: number, value: number) => {
    setFormData(prev => {
      const updatedPrices = [...prev.defaultPrice]
      updatedPrices[index] = value
      return { ...prev, defaultPrice: updatedPrices }
    })
  }, [])

  const removePrice = useCallback((index: number) => {
    setFormData(prev => ({
      ...prev,
      defaultPrice: prev.defaultPrice.filter((_, i) => i !== index)
    }))
  }, [])

  const handleLogoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLogoError('')
    setIsUploadingLogo(true)

    try {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
      if (!allowedTypes.includes(file.type)) {
        setLogoError('Invalid file type. Only images are allowed.')
        setIsUploadingLogo(false)
        return
      }

      const maxSize = 5 * 1024 * 1024
      if (file.size > maxSize) {
        setLogoError('File size exceeds 5MB limit')
        setIsUploadingLogo(false)
        return
      }

      const reader = new FileReader()
      reader.onloadend = () => {
        setLogoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)

      // Get auth token directly from localStorage to avoid session refresh timeout
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

      const token = getAuthToken()

      if (!token) {
        throw new Error('No authentication token found. Please log in again.')
      }

      console.log('📤 Starting logo upload...', file.name, file.size)

      const uploadFormData = new FormData()
      uploadFormData.append('file', file)

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000)

      let response: Response
      try {
        response = await fetch('/api/admin/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: uploadFormData,
          signal: controller.signal
        })
        clearTimeout(timeoutId)
      } catch (fetchError: any) {
        clearTimeout(timeoutId)
        if (fetchError.name === 'AbortError') {
          throw new Error('Upload timeout. Please try again with a smaller file.')
        }
        throw fetchError
      }

      console.log('📥 Upload response status:', response.status, response.statusText)

      let data: any
      try {
        data = await response.json()
        console.log('📥 Upload response data:', data)
      } catch (jsonError) {
        const text = await response.text()
        console.error('❌ Failed to parse response as JSON:', text)
        throw new Error('Invalid response from server')
      }

      if (!response.ok) {
        console.error('❌ Upload failed:', data)
        throw new Error(data.error || data.details?.message || 'Failed to upload logo')
      }

      if (!data.logo) {
        throw new Error('Upload succeeded but no logo reference returned')
      }

      console.log('✅ Logo uploaded successfully:', data.logo)

      setFormData(prev => ({
        ...prev,
        logo: data.logo
      }))

      // Reset file input by changing key to force re-render
      setFileInputKey(prev => prev + 1)
    } catch (err: any) {
      console.error('Logo upload error:', err)
      setLogoError(err.message || 'Failed to upload logo')
      setLogoPreview(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } finally {
      setIsUploadingLogo(false)
    }
  }, [])

  const handleRemoveLogo = useCallback(() => {
    setFormData(prev => ({ ...prev, logo: null }))
    setLogoPreview(null)
    setLogoError('')
    // Reset file input by changing key to force re-render
    setFileInputKey(prev => prev + 1)
  }, [])

  useEffect(() => {
    if (success) {
      setFormData({
        name: '',
        domain_authority: null,
        domain_rating: null,
        estimated_time: '',
        sponsored: '',
        indexed: '',
        do_follow: '',
        health: false,
        cbd: false,
        crypto: false,
        gambling: false,
        erotic: false,
        defaultPrice: [],
        genres: [],
        regions: [],
        logo: null,
        articlePreview: null,
        example_url: '',
      })
      setLogoPreview(null)
      setLogoError('')
      // Reset file input by changing key to force re-render
      setFileInputKey(prev => prev + 1)
    }
  }, [success])

  return (
    <div className="fixed z-[9999] inset-0 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity z-[9998]" onClick={onClose}></div>
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full z-[9999] relative">
          <form onSubmit={handleSubmit}>
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4 max-h-[70vh] overflow-y-auto">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                {isEditMode ? 'Edit Best Seller' : 'Add New Best Seller'}
              </h3>
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
              <div className="space-y-4">
                {/* Basic Information */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                  <input
                    type="text"
                    required
                    className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Domain Authority</label>
                    <DebouncedInput
                      type="number"
                      className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      value={formData.domain_authority}
                      onChange={(value) => setFormData(prev => ({ ...prev, domain_authority: value as number | null }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Domain Rating</label>
                    <DebouncedInput
                      type="number"
                      className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      value={formData.domain_rating}
                      onChange={(value) => setFormData(prev => ({ ...prev, domain_rating: value as number | null }))}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Estimated Time</label>
                  <DebouncedInput
                    type="text"
                    className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    value={formData.estimated_time}
                    onChange={(value) => setFormData(prev => ({ ...prev, estimated_time: value as string }))}
                    placeholder="e.g., 4-6 Weeks"
                  />
                </div>

                {/* Logo Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Publication Logo</label>
                  <div className="space-y-2">
                    {logoPreview && (
                      <div className="relative inline-block">
                        <img
                          src={logoPreview}
                          alt="Logo preview"
                          className="w-20 h-20 object-cover rounded-full border-2 border-gray-300"
                        />
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                        >
                          ×
                        </button>
                      </div>
                    )}
                    <div>
                      <input
                        key={fileInputKey}
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                        onChange={handleLogoUpload}
                        disabled={isUploadingLogo}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-50"
                      />
                      {isUploadingLogo && (
                        <div className="mt-1">
                          <p className="text-sm text-gray-500">Uploading...</p>
                          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                            <div className="bg-indigo-600 h-1.5 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                          </div>
                        </div>
                      )}
                      {logoError && (
                        <div className="mt-1 rounded-md bg-red-50 p-2">
                          <p className="text-sm text-red-600">{logoError}</p>
                        </div>
                      )}
                      {formData.logo && !logoError && !isUploadingLogo && (
                        <p className="mt-1 text-sm text-green-600">✓ Logo uploaded successfully</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Pricing */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Default Prices</label>
                  {formData.defaultPrice.map((price, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <input
                        type="number"
                        className="flex-1 border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        value={price}
                        onChange={(e) => updatePrice(index, parseFloat(e.target.value) || 0)}
                      />
                      <button
                        type="button"
                        onClick={() => removePrice(index)}
                        className="px-3 py-2 text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addPrice}
                    className="text-sm text-indigo-600 hover:text-indigo-800"
                  >
                    + Add Default Price
                  </button>
                </div>

                {/* Genres */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Genres</label>
                  {formData.genres.map((genre, index) => (
                    <div key={index} className="border p-3 rounded mb-2">
                      <div className="flex gap-2">
                        <select
                          className="flex-1 border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          value={genre.name}
                          onChange={(e) => updateGenre(index, 'name', e.target.value)}
                        >
                          <option value="">Select a genre</option>
                          <option value="News">News</option>
                          <option value="Lifestyle">Lifestyle</option>
                          <option value="Entertainment">Entertainment</option>
                          <option value="Business">Business</option>
                          <option value="Tech">Tech</option>
                          <option value="Music">Music</option>
                          <option value="Web 3">Web 3</option>
                          <option value="Luxury">Luxury</option>
                          <option value="Fashion">Fashion</option>
                          <option value="Real Estate">Real Estate</option>
                          <option value="Sports">Sports</option>
                          <option value="Gaming">Gaming</option>
                          <option value="Political">Political</option>
                          <option value="Legal">Legal</option>
                          <option value="Alcohol">Alcohol</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => removeGenre(index)}
                          className="px-3 py-2 text-red-600 hover:text-red-800"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addGenre}
                    className="text-sm text-indigo-600 hover:text-indigo-800"
                  >
                    + Add Genre
                  </button>
                </div>

                {/* Regions */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Regions</label>
                  {formData.regions.map((region, index) => (
                    <div key={index} className="border p-3 rounded mb-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Name"
                          className="flex-1 border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          value={region.name}
                          onChange={(e) => updateRegion(index, 'name', e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => removeRegion(index)}
                          className="px-3 py-2 text-red-600 hover:text-red-800"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addRegion}
                    className="text-sm text-indigo-600 hover:text-indigo-800"
                  >
                    + Add Region
                  </button>
                </div>

                {/* Status Fields */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Sponsored</label>
                    <select
                      className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      value={formData.sponsored}
                      onChange={(e) => setFormData(prev => ({ ...prev, sponsored: e.target.value }))}
                    >
                      <option value="">Select</option>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                      <option value="Discrete">Discrete</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Indexed</label>
                    <select
                      className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      value={formData.indexed}
                      onChange={(e) => setFormData(prev => ({ ...prev, indexed: e.target.value }))}
                    >
                      <option value="">Select</option>
                      <option value="Yes">Yes</option>
                      <option value="Maybe">Maybe</option>
                      <option value="No">No</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Do Follow</label>
                    <select
                      className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      value={formData.do_follow}
                      onChange={(e) => setFormData(prev => ({ ...prev, do_follow: e.target.value }))}
                    >
                      <option value="">Select</option>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </div>
                </div>

                {/* <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Example URL</label>
                  <DebouncedInput
                    type="url"
                    className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    value={formData.example_url}
                    onChange={(value) => setFormData(prev => ({ ...prev, example_url: value as string }))}
                  />
                </div> */}

                {/* Niches */}
                <div className="border p-4 rounded">
                  <label className="block text-sm font-medium text-gray-700 mb-3">Niches</label>
                  <div className="space-y-3">
                    <div className="flex items-center gap-4">
                      <input
                        type="checkbox"
                        checked={formData.health}
                        onChange={(e) => setFormData(prev => ({ ...prev, health: e.target.checked }))}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <label className="text-sm font-medium text-gray-700">Health</label>
                    </div>
                    <div className="flex items-center gap-4">
                      <input
                        type="checkbox"
                        checked={formData.cbd}
                        onChange={(e) => setFormData(prev => ({ ...prev, cbd: e.target.checked }))}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <label className="text-sm font-medium text-gray-700">CBD</label>
                    </div>
                    <div className="flex items-center gap-4">
                      <input
                        type="checkbox"
                        checked={formData.crypto}
                        onChange={(e) => setFormData(prev => ({ ...prev, crypto: e.target.checked }))}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <label className="text-sm font-medium text-gray-700">Crypto</label>
                    </div>
                    <div className="flex items-center gap-4">
                      <input
                        type="checkbox"
                        checked={formData.gambling}
                        onChange={(e) => setFormData(prev => ({ ...prev, gambling: e.target.checked }))}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <label className="text-sm font-medium text-gray-700">Gambling</label>
                    </div>
                    <div className="flex items-center gap-4">
                      <input
                        type="checkbox"
                        checked={formData.erotic}
                        onChange={(e) => setFormData(prev => ({ ...prev, erotic: e.target.checked }))}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <label className="text-sm font-medium text-gray-700">Erotic</label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {isEditMode ? 'Updating...' : 'Adding...'}
                  </>
                ) : (
                  isEditMode ? 'Update' : 'Add'
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default memo(AddBestSellerForm)

