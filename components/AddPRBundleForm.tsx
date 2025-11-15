'use client'

import { useState, useCallback, useRef, useEffect, memo } from 'react'

interface Bundle {
  name: string
  retailValue: string
  publications: string[]
}

interface FormData {
  category: string
  bundles: Bundle[]
}

interface AddPRBundleFormProps {
  onClose: () => void
  onSubmit: (data: FormData) => Promise<void>
  error?: string
  success?: string
  initialData?: any // PRBundle data for edit mode
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

// Special input component for retail value that only accepts numbers and adds $ prefix
const RetailValueInput = memo(({ 
  value, 
  onChange, 
  ...props 
}: { 
  value: string | null
  onChange: (value: string | null) => void
  [key: string]: any
}) => {
  // Extract numeric value from prop (remove $ and commas)
  const numericValue = value ? value.replace(/[$,]/g, '') : ''
  const [localValue, setLocalValue] = useState(numericValue)
  const debouncedValue = useDebounce(localValue, 300)
  const isInitialMount = useRef(true)

  // Update local value when prop changes (e.g., form reset or edit mode)
  useEffect(() => {
    const newNumericValue = value ? value.replace(/[$,]/g, '') : ''
    if (isInitialMount.current) {
      isInitialMount.current = false
      setLocalValue(newNumericValue)
      return
    }
    // Only update if the numeric value actually changed
    setLocalValue(prev => {
      const prevNumeric = prev.replace(/[$,]/g, '')
      return prevNumeric !== newNumericValue ? newNumericValue : prev
    })
  }, [value])

  // Update parent when debounced value changes
  useEffect(() => {
    const currentNumericValue = value ? value.replace(/[$,]/g, '') : ''
    if (debouncedValue !== currentNumericValue) {
      if (debouncedValue && debouncedValue.trim() !== '') {
        const numValue = parseFloat(debouncedValue)
        if (!isNaN(numValue)) {
          const formattedValue = `$${numValue.toLocaleString('en-US', { 
            minimumFractionDigits: 0, 
            maximumFractionDigits: 2 
          })}`
          onChange(formattedValue)
        } else {
          onChange('')
        }
      } else {
        // Empty value - send empty string
        onChange('')
      }
    }
  }, [debouncedValue, onChange, value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value
    
    // Remove all non-numeric characters except decimal point
    let numericValue = inputValue.replace(/[^\d.]/g, '')
    
    // Only allow one decimal point
    const parts = numericValue.split('.')
    if (parts.length > 2) {
      numericValue = parts[0] + '.' + parts.slice(1).join('')
    }
    
    // Limit to 2 decimal places
    if (parts.length === 2 && parts[1].length > 2) {
      numericValue = parts[0] + '.' + parts[1].substring(0, 2)
    }
    
    setLocalValue(numericValue)
  }

  const handleBlur = () => {
    // Format the value when user leaves the field
    if (localValue && localValue.trim() !== '') {
      const numValue = parseFloat(localValue)
      if (!isNaN(numValue)) {
        const formatted = numValue.toLocaleString('en-US', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        })
        setLocalValue(formatted)
      }
    }
  }

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 pointer-events-none">$</span>
      <input
        {...props}
        type="text"
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        className="w-full pl-8 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        placeholder="500"
        inputMode="decimal"
      />
    </div>
  )
})

RetailValueInput.displayName = 'RetailValueInput'

const getInitialFormData = (initialData?: any): FormData => {
  if (!initialData) {
    return {
      category: '',
      bundles: []
    }
  }

  return {
    category: initialData.category || '',
    bundles: initialData.bundles || []
  }
}

export default function AddPRBundleForm({ 
  onClose, 
  onSubmit, 
  error, 
  success, 
  initialData, 
  isEditMode = false 
}: AddPRBundleFormProps) {
  const [formData, setFormData] = useState<FormData>(() => getInitialFormData(initialData))
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Update form when initialData changes (for edit mode)
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

  const handleAddBundle = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      bundles: [...prev.bundles, { name: '', retailValue: '', publications: [] }]
    }))
  }, [])

  const handleRemoveBundle = useCallback((index: number) => {
    setFormData(prev => ({
      ...prev,
      bundles: prev.bundles.filter((_, i) => i !== index)
    }))
  }, [])

  const handleBundleChange = useCallback((index: number, field: keyof Bundle, value: string | string[]) => {
    setFormData(prev => ({
      ...prev,
      bundles: prev.bundles.map((bundle, i) => 
        i === index ? { ...bundle, [field]: value } : bundle
      )
    }))
  }, [])

  const handleAddPublication = useCallback((bundleIndex: number) => {
    setFormData(prev => ({
      ...prev,
      bundles: prev.bundles.map((bundle, i) => 
        i === bundleIndex 
          ? { ...bundle, publications: [...bundle.publications, ''] }
          : bundle
      )
    }))
  }, [])

  const handleRemovePublication = useCallback((bundleIndex: number, pubIndex: number) => {
    setFormData(prev => ({
      ...prev,
      bundles: prev.bundles.map((bundle, i) => 
        i === bundleIndex 
          ? { ...bundle, publications: bundle.publications.filter((_, j) => j !== pubIndex) }
          : bundle
      )
    }))
  }, [])

  const handlePublicationChange = useCallback((bundleIndex: number, pubIndex: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      bundles: prev.bundles.map((bundle, i) => 
        i === bundleIndex 
          ? { 
              ...bundle, 
              publications: bundle.publications.map((pub, j) => j === pubIndex ? value : pub)
            }
          : bundle
      )
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
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">
              {isEditMode ? 'Edit PR Bundle Category' : 'Add New PR Bundle Category'}
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

            {/* Bundles */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Bundles
                </label>
                <button
                  type="button"
                  onClick={handleAddBundle}
                  className="text-sm bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  + Add Bundle
                </button>
              </div>

              <div className="space-y-4">
                {formData.bundles.map((bundle, bundleIndex) => (
                  <div key={bundleIndex} className="border border-gray-300 rounded-md p-4 bg-gray-50">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-sm font-medium text-gray-700">Bundle {bundleIndex + 1}</h3>
                      <button
                        type="button"
                        onClick={() => handleRemoveBundle(bundleIndex)}
                        className="text-sm text-red-600 hover:text-red-800 px-2 py-1 border border-red-600 rounded hover:bg-red-50"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      {/* Bundle Name */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Bundle Name
                        </label>
                        <DebouncedInput
                          type="text"
                          value={bundle.name}
                          onChange={(value) => handleBundleChange(bundleIndex, 'name', value || '')}
                          className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="e.g., Starter Bundle"
                        />
                      </div>

                      {/* Retail Value */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Retail Value
                        </label>
                        <RetailValueInput
                          value={bundle.retailValue}
                          onChange={(value) => handleBundleChange(bundleIndex, 'retailValue', value || '')}
                          placeholder="500"
                        />
                      </div>
                    </div>

                    {/* Publications */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-xs font-medium text-gray-700">
                          Publications
                        </label>
                        <button
                          type="button"
                          onClick={() => handleAddPublication(bundleIndex)}
                          className="text-xs bg-blue-600 text-white px-2 py-1 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          + Add Publication
                        </button>
                      </div>

                      <div className="space-y-2">
                        {bundle.publications.map((publication, pubIndex) => (
                          <div key={pubIndex} className="flex gap-2">
                            <DebouncedInput
                              type="text"
                              value={publication}
                              onChange={(value) => handlePublicationChange(bundleIndex, pubIndex, value || '')}
                              className="flex-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="Enter publication name"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemovePublication(bundleIndex, pubIndex)}
                              className="text-red-600 hover:text-red-800 px-3 py-2 border border-red-600 rounded hover:bg-red-50"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        {bundle.publications.length === 0 && (
                          <p className="text-xs text-gray-500 italic">No publications added yet</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {formData.bundles.length === 0 && (
                  <p className="text-sm text-gray-500 italic text-center py-4">No bundles added yet. Click &quot;Add Bundle&quot; to get started.</p>
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
                {isSubmitting ? 'Saving...' : (isEditMode ? 'Update Category' : 'Add Category')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

