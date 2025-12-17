'use client'

import { useState, useCallback, useRef, useEffect, memo } from 'react'

interface Magazine {
  id: string
  name: string
  url: string
  details: string[]
}

interface FormData {
  category: string
  magazines: Magazine[]
}

interface SubmitData {
  category: string
  magazines: Omit<Magazine, 'id'>[]
}

interface EditPrintFormProps {
  onClose: () => void
  onSubmit: (data: SubmitData) => Promise<void>
  error?: string
  success?: string
  initialData: any // Print data for edit mode
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
  value: string | null
  onChange: (value: string | null) => void
  [key: string]: any
}) => {
  const [localValue, setLocalValue] = useState(value ?? '')
  const debouncedValue = useDebounce(localValue, 150)
  const isInitialMount = useRef(true)

  // Update local value when prop changes (e.g., form reset)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    setLocalValue(value ?? '')
  }, [value])

  // Update parent when debounced value changes
  useEffect(() => {
    if (debouncedValue !== value) {
      onChange(debouncedValue === '' ? null : debouncedValue)
    }
  }, [debouncedValue, onChange])

  return (
    <input
      {...props}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
    />
  )
})

DebouncedInput.displayName = 'DebouncedInput'

const getInitialFormData = (initialData: any): FormData => {
  return {
    category: initialData.category || '',
    magazines: (initialData.magazines || []).map((magazine: any) => ({
      ...magazine,
      id: magazine.id || `magazine-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }))
  }
}

export default function EditPrintForm({ 
  onClose, 
  onSubmit, 
  error, 
  success, 
  initialData
}: EditPrintFormProps) {
  const [formData, setFormData] = useState<FormData>(() => getInitialFormData(initialData))
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Update form when initialData changes
  useEffect(() => {
    if (initialData) {
      setFormData(getInitialFormData(initialData))
    }
  }, [initialData])

  const handleCategoryChange = useCallback((value: string | null) => {
    setFormData(prev => ({
      ...prev,
      category: value || ''
    }))
  }, [])

  const handleAddMagazine = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      magazines: [...prev.magazines, { 
        id: `magazine-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: '', 
        url: '', 
        details: [] 
      }]
    }))
  }, [])

  const handleRemoveMagazine = useCallback((magazineId: string) => {
    setFormData(prev => ({
      ...prev,
      magazines: prev.magazines.filter(magazine => magazine.id !== magazineId)
    }))
  }, [])

  const handleMagazineChange = useCallback((magazineId: string, field: keyof Magazine, value: string | string[]) => {
    setFormData(prev => ({
      ...prev,
      magazines: prev.magazines.map((magazine) => 
        magazine.id === magazineId ? { ...magazine, [field]: value } : magazine
      )
    }))
  }, [])

  const handleAddDetail = useCallback((magazineId: string) => {
    setFormData(prev => ({
      ...prev,
      magazines: prev.magazines.map((magazine) => 
        magazine.id === magazineId 
          ? { ...magazine, details: [...magazine.details, ''] }
          : magazine
      )
    }))
  }, [])

  const handleRemoveDetail = useCallback((magazineId: string, detailIndex: number) => {
    setFormData(prev => ({
      ...prev,
      magazines: prev.magazines.map((magazine) => 
        magazine.id === magazineId 
          ? { ...magazine, details: magazine.details.filter((_, j) => j !== detailIndex) }
          : magazine
      )
    }))
  }, [])

  const handleDetailChange = useCallback((magazineId: string, detailIndex: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      magazines: prev.magazines.map((magazine) => 
        magazine.id === magazineId 
          ? { 
              ...magazine, 
              details: magazine.details.map((detail, j) => j === detailIndex ? value : detail)
            }
          : magazine
      )
    }))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    setIsSubmitting(true)
    try {
      // Remove temporary IDs before sending to API
      const dataToSend = {
        category: formData.category,
        magazines: formData.magazines.map(({ id, ...magazine }) => magazine)
      }
      console.log('📝 [EditPrintForm] Sending complete record:', dataToSend)
      await onSubmit(dataToSend)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">
              Edit Print Category
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
              disabled={isSubmitting}
            >
              ×
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Category - Required */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category *
              </label>
              <DebouncedInput
                type="text"
                value={formData.category}
                onChange={handleCategoryChange}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter category name"
                required
              />
            </div>

            {/* Magazines */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Magazines
                </label>
                <button
                  type="button"
                  onClick={handleAddMagazine}
                  className="text-sm bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  + Add Magazine
                </button>
              </div>

              <div className="space-y-4">
                {formData.magazines.map((magazine, magazineIndex) => (
                  <div key={magazine.id} className="border border-gray-300 rounded-md p-4 bg-gray-50">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-sm font-medium text-gray-700">Magazine {magazineIndex + 1}</h3>
                      <button
                        type="button"
                        onClick={() => handleRemoveMagazine(magazine.id)}
                        className="text-sm text-red-600 hover:text-red-800 px-2 py-1 border border-red-600 rounded hover:bg-red-50"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="space-y-3">
                      {/* Magazine Name */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Magazine Name
                        </label>
                        <DebouncedInput
                          type="text"
                          value={magazine.name}
                          onChange={(value) => handleMagazineChange(magazine.id, 'name', value || '')}
                          className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="e.g., Forbes, Time Magazine"
                        />
                      </div>

                      {/* Magazine URL */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Magazine URL
                        </label>
                        <DebouncedInput
                          type="url"
                          value={magazine.url}
                          onChange={(value) => handleMagazineChange(magazine.id, 'url', value || '')}
                          className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="https://example.com/magazine"
                          pattern="https?://.+"
                          title="Enter a valid URL starting with http:// or https://"
                        />
                      </div>

                      {/* Details */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="block text-xs font-medium text-gray-700">
                            Details
                          </label>
                          <button
                            type="button"
                            onClick={() => handleAddDetail(magazine.id)}
                            className="text-xs bg-blue-600 text-white px-2 py-1 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            + Add Detail
                          </button>
                        </div>

                        <div className="space-y-2">
                          {magazine.details.map((detail, detailIndex) => (
                            <div key={detailIndex} className="flex gap-2">
                              <DebouncedInput
                                type="text"
                                value={detail}
                                onChange={(value) => handleDetailChange(magazine.id, detailIndex, value || '')}
                                className="flex-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Enter detail"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveDetail(magazine.id, detailIndex)}
                                className="text-red-600 hover:text-red-800 px-3 py-2 border border-red-600 rounded hover:bg-red-50"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                          {magazine.details.length === 0 && (
                            <p className="text-xs text-gray-500 italic">No details added yet</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {formData.magazines.length === 0 && (
                  <p className="text-sm text-gray-500 italic text-center py-4">No magazines added yet. Click &quot;Add Magazine&quot; to get started.</p>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmitting || !formData.category.trim()}
              >
                {isSubmitting ? 'Updating...' : 'Update Category'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}


