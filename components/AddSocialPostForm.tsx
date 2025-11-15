'use client'

import { useState, useCallback, useRef, useEffect, memo } from 'react'
import { createClient } from '@/lib/supabase-client'

interface FormData {
  publication: string
  image: string
  url: string
  platforms: string[]
  price: string
  tat: string
  exampleUrl: string
}

interface AddSocialPostFormProps {
  onClose: () => void
  onSubmit: (data: FormData) => Promise<void>
  error?: string
  success?: string
  initialData?: any
  isEditMode?: boolean
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])
  return debouncedValue
}

const DebouncedInput = memo(({ value, onChange, ...props }: { value: string | null; onChange: (value: string | null) => void; [key: string]: any }) => {
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
  return <input {...props} value={localValue} onChange={(e) => setLocalValue(e.target.value)} />
})
DebouncedInput.displayName = 'DebouncedInput'

const RateInput = memo(({ value, onChange, ...props }: { value: string | null; onChange: (value: string | null) => void; [key: string]: any }) => {
  const numericValue = value ? value.replace(/[$,]/g, '') : ''
  const [localValue, setLocalValue] = useState(numericValue)
  const debouncedValue = useDebounce(localValue, 300)
  const isInitialMount = useRef(true)
  useEffect(() => {
    const newNumericValue = value ? value.replace(/[$,]/g, '') : ''
    if (isInitialMount.current) {
      isInitialMount.current = false
      setLocalValue(newNumericValue)
      return
    }
    setLocalValue(prev => {
      const prevNumeric = prev.replace(/[$,]/g, '')
      return prevNumeric !== newNumericValue ? newNumericValue : prev
    })
  }, [value])
  useEffect(() => {
    const currentNumericValue = value ? value.replace(/[$,]/g, '') : ''
    if (debouncedValue !== currentNumericValue) {
      if (debouncedValue && debouncedValue.trim() !== '') {
        const numValue = parseFloat(debouncedValue)
        if (!isNaN(numValue)) {
          onChange(`$${numValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`)
        } else {
          onChange('')
        }
      } else {
        onChange('')
      }
    }
  }, [debouncedValue, onChange, value])
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let numericValue = e.target.value.replace(/[^\d.]/g, '')
    const parts = numericValue.split('.')
    if (parts.length > 2) numericValue = parts[0] + '.' + parts.slice(1).join('')
    if (parts.length === 2 && parts[1].length > 2) numericValue = parts[0] + '.' + parts[1].substring(0, 2)
    setLocalValue(numericValue)
  }
  const handleBlur = () => {
    if (localValue && localValue.trim() !== '') {
      const numValue = parseFloat(localValue)
      if (!isNaN(numValue)) {
        setLocalValue(numValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }))
      }
    }
  }
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 pointer-events-none">$</span>
      <input {...props} type="text" value={localValue} onChange={handleChange} onBlur={handleBlur} className="w-full pl-8 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="500" inputMode="decimal" />
    </div>
  )
})
RateInput.displayName = 'RateInput'

export default function AddSocialPostForm({ onClose, onSubmit, error, success, initialData, isEditMode = false }: AddSocialPostFormProps) {
  const [formData, setFormData] = useState<FormData>(() => ({
    publication: initialData?.publication || '',
    image: initialData?.image || '',
    url: initialData?.url || '',
    platforms: initialData?.platforms || [],
    price: initialData?.price || '',
    tat: initialData?.tat || '',
    exampleUrl: initialData?.exampleUrl || ''
  }))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [imageError, setImageError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
    if (initialData) {
      setFormData({
        publication: initialData.publication || '',
        image: initialData.image || '',
        url: initialData.url || '',
        platforms: initialData.platforms || [],
        price: initialData.price || '',
        tat: initialData.tat || '',
        exampleUrl: initialData.exampleUrl || ''
      })
      if (initialData.image) {
        if (typeof initialData.image === 'string') {
          try {
            // Try parsing as JSON string (Supabase/Sanity metadata)
            const parsed = JSON.parse(initialData.image)
            if (parsed && typeof parsed === 'object') {
              // It's a stringified object
              if (parsed.asset?._metadata?.isSupabaseUpload && parsed.asset._metadata.storagePath) {
                // Supabase upload - get public URL
                const { data: { publicUrl } } = supabase.storage
                  .from('publications')
                  .getPublicUrl(parsed.asset._metadata.storagePath)
                setImagePreview(publicUrl)
              } else if (parsed.asset?._ref) {
                // Legacy Sanity format - use Sanity CDN
                const ref = parsed.asset._ref.replace('image-', '')
                const imageUrl = `https://cdn.sanity.io/images/8n90kyzz/production/${ref.replace(/-png$/, '.png').replace(/-jpg$/, '.jpg').replace(/-jpeg$/, '.jpeg').replace(/-webp$/, '.webp')}?w=80&h=80&fit=crop&auto=format&q=75`
                setImagePreview(imageUrl)
              } else {
                // Fallback to original string
                setImagePreview(`https://pricing.ascendagency.com${initialData.image.replace(/&amp;/g, '&')}`)
              }
            } else {
              // Not an object, use as URL
              setImagePreview(`https://pricing.ascendagency.com${initialData.image.replace(/&amp;/g, '&')}`)
            }
          } catch (e) {
            // Not JSON, treat as legacy string format
            setImagePreview(`https://pricing.ascendagency.com${initialData.image.replace(/&amp;/g, '&')}`)
          }
        } else if (typeof initialData.image === 'object' && initialData.image !== null) {
          // Already an object
          const imageData = initialData.image as any
          if (imageData.asset?._metadata?.isSupabaseUpload && imageData.asset._metadata.storagePath) {
            // Supabase upload - get public URL
            const { data: { publicUrl } } = supabase.storage
              .from('publications')
              .getPublicUrl(imageData.asset._metadata.storagePath)
            setImagePreview(publicUrl)
          } else if (imageData.asset?._ref) {
            // Legacy Sanity format
            const ref = imageData.asset._ref.replace('image-', '')
            const imageUrl = `https://cdn.sanity.io/images/8n90kyzz/production/${ref.replace(/-png$/, '.png').replace(/-jpg$/, '.jpg').replace(/-jpeg$/, '.jpeg').replace(/-webp$/, '.webp')}?w=80&h=80&fit=crop&auto=format&q=75`
            setImagePreview(imageUrl)
          }
        }
      }
    }
  }, [initialData, supabase])

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageError('')
    setIsUploadingImage(true)
    try {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
      if (!allowedTypes.includes(file.type)) {
        setImageError('Invalid file type. Only images are allowed.')
        setIsUploadingImage(false)
        return
      }
      const maxSize = 5 * 1024 * 1024
      if (file.size > maxSize) {
        setImageError('File size exceeds 5MB limit')
        setIsUploadingImage(false)
        return
      }
      const reader = new FileReader()
      reader.onloadend = () => setImagePreview(reader.result as string)
      reader.readAsDataURL(file)
      const getAuthToken = () => {
        try {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
          let projectRef = 'default'
          try {
            const urlMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)
            if (urlMatch && urlMatch[1]) projectRef = urlMatch[1]
            else {
              const parts = supabaseUrl.split('//')
              if (parts[1]) projectRef = parts[1].split('.')[0]
            }
          } catch (e) {}
          const storageKey = `sb-${projectRef}-auth-token`
          const stored = localStorage.getItem(storageKey)
          if (stored) {
            const parsed = JSON.parse(stored)
            if (parsed?.access_token && parsed?.expires_at) {
              const expiresAt = parsed.expires_at * 1000
              if (expiresAt > Date.now()) return parsed.access_token
            }
          }
        } catch (error) {}
        return ''
      }
      const token = getAuthToken()
      if (!token) throw new Error('No authentication token found. Please log in again.')
      const uploadFormData = new FormData()
      uploadFormData.append('file', file)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000)
      let response: Response
      try {
        response = await fetch('/api/admin/upload', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: uploadFormData,
          signal: controller.signal
        })
        clearTimeout(timeoutId)
      } catch (fetchError: any) {
        clearTimeout(timeoutId)
        if (fetchError.name === 'AbortError') throw new Error('Upload timeout. Please try again with a smaller file.')
        throw fetchError
      }
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || data.details?.message || 'Failed to upload image')
      if (!data.logo) throw new Error('Upload succeeded but no image reference returned')
      const logoObj = data.logo
      if (logoObj.asset?._metadata?.isSupabaseUpload && logoObj.asset._metadata.storagePath) {
        // Store the full metadata object as JSON string for Supabase uploads
        const imageData = JSON.stringify(logoObj)
        setFormData(prev => ({ ...prev, image: imageData }))
        // Get public URL for preview
        const { data: { publicUrl } } = supabase.storage.from('publications').getPublicUrl(logoObj.asset._metadata.storagePath)
        setImagePreview(publicUrl)
      } else if (logoObj.asset?._ref) {
        // Legacy Sanity format - store as JSON string
        const imageData = JSON.stringify(logoObj)
        setFormData(prev => ({ ...prev, image: imageData }))
        const ref = logoObj.asset._ref.replace('image-', '')
        const imageUrl = `https://cdn.sanity.io/images/8n90kyzz/production/${ref.replace(/-png$/, '.png').replace(/-jpg$/, '.jpg').replace(/-jpeg$/, '.jpeg').replace(/-webp$/, '.webp')}?w=80&h=80&fit=crop&auto=format&q=75`
        setImagePreview(imageUrl)
      }
    } catch (err: any) {
      setImageError(err.message || 'Failed to upload image')
      setImagePreview(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } finally {
      setIsUploadingImage(false)
    }
  }, [supabase])

  const handleInputChange = useCallback((field: keyof FormData) => (value: string | null) => {
    setFormData(prev => ({ ...prev, [field]: value || '' }))
  }, [])

  const handleAddPlatform = useCallback(() => {
    setFormData(prev => ({ ...prev, platforms: [...prev.platforms, ''] }))
  }, [])

  const handleRemovePlatform = useCallback((index: number) => {
    setFormData(prev => ({ ...prev, platforms: prev.platforms.filter((_, i) => i !== index) }))
  }, [])

  const handlePlatformChange = useCallback((index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      platforms: prev.platforms.map((p, i) => i === index ? value : p)
    }))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      await onSubmit(formData)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">{isEditMode ? 'Edit Social Post' : 'Add New Social Post'}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl" disabled={isSubmitting}>×</button>
          </div>
          {error && <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">{error}</div>}
          {success && <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">{success}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Publication *</label>
                <DebouncedInput type="text" value={formData.publication} onChange={handleInputChange('publication')} className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Enter publication name" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
                <DebouncedInput type="url" value={formData.url} onChange={handleInputChange('url')} className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="https://example.com" pattern="https?://.+" title="Enter a valid URL" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
                <RateInput value={formData.price} onChange={handleInputChange('price')} placeholder="500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">TAT</label>
                <DebouncedInput type="text" value={formData.tat} onChange={handleInputChange('tat')} className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="e.g., 2-4 Weeks" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Image</label>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} disabled={isUploadingImage} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-50" />
              {isUploadingImage && <div className="mt-1"><p className="text-sm text-gray-500">Uploading...</p><div className="w-full bg-gray-200 rounded-full h-1.5 mt-1"><div className="bg-indigo-600 h-1.5 rounded-full animate-pulse" style={{ width: '60%' }}></div></div></div>}
              {imageError && <div className="mt-1 rounded-md bg-red-50 p-2"><p className="text-sm text-red-600">{imageError}</p></div>}
              {imagePreview && <div className="mt-2"><img src={imagePreview} alt="Preview" className="w-20 h-20 object-cover rounded-full" /></div>}
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">Platforms</label>
                <button type="button" onClick={handleAddPlatform} className="text-sm bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700">+ Add Platform</button>
              </div>
              <div className="space-y-2">
                {formData.platforms.map((platform, index) => (
                  <div key={index} className="flex gap-2">
                    <DebouncedInput type="text" value={platform} onChange={(value) => handlePlatformChange(index, value || '')} className="flex-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="e.g., Facebook, Instagram" />
                    <button type="button" onClick={() => handleRemovePlatform(index)} className="text-red-600 hover:text-red-800 px-3 py-2 border border-red-600 rounded hover:bg-red-50">×</button>
                  </div>
                ))}
                {formData.platforms.length === 0 && <p className="text-xs text-gray-500 italic">No platforms added yet</p>}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Example URL</label>
              <DebouncedInput type="url" value={formData.exampleUrl} onChange={handleInputChange('exampleUrl')} className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="https://example.com/video" pattern="https?://.+" title="Enter a valid URL" />
            </div>
            <div className="flex justify-end space-x-3 pt-4">
              <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50" disabled={isSubmitting}>Cancel</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed" disabled={isSubmitting || !formData.publication.trim()}>{isSubmitting ? 'Saving...' : (isEditMode ? 'Update' : 'Add')}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

