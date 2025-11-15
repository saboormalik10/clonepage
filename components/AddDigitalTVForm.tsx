'use client'

import { useState, useCallback, useRef, useEffect, memo } from 'react'

interface FormData {
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

interface AddDigitalTVFormProps {
  onClose: () => void
  onSubmit: (data: FormData) => Promise<void>
  error?: string
  success?: string
  initialData?: any // DigitalTV data for edit mode
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

// Special input component for rate that only accepts numbers and adds $ prefix
const RateInput = memo(({ 
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

RateInput.displayName = 'RateInput'

const getInitialFormData = (initialData?: any): FormData => {
  if (!initialData) {
    return {
      callSign: '',
      station: '',
      rate: '',
      tat: '',
      sponsored: '',
      indexed: '',
      segmentLength: '',
      location: '',
      programName: '',
      interviewType: '',
      exampleUrl: ''
    }
  }

  return {
    callSign: initialData.callSign || '',
    station: initialData.station || '',
    rate: initialData.rate || '',
    tat: initialData.tat || '',
    sponsored: initialData.sponsored || '',
    indexed: initialData.indexed || '',
    segmentLength: initialData.segmentLength || '',
    location: initialData.location || '',
    programName: initialData.programName || '',
    interviewType: initialData.interviewType || '',
    exampleUrl: initialData.exampleUrl || ''
  }
}

export default function AddDigitalTVForm({ 
  onClose, 
  onSubmit, 
  error, 
  success, 
  initialData, 
  isEditMode = false 
}: AddDigitalTVFormProps) {
  const [formData, setFormData] = useState<FormData>(() => getInitialFormData(initialData))
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Update form when initialData changes (for edit mode)
  useEffect(() => {
    if (initialData) {
      setFormData(getInitialFormData(initialData))
    }
  }, [initialData])

  const handleInputChange = useCallback((field: keyof FormData) => (value: string | null) => {
    setFormData(prev => ({
      ...prev,
      [field]: value || ''
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
            <h2 className="text-xl font-semibold">
              {isEditMode ? 'Edit Digital TV Record' : 'Add New Digital TV Record'}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Station - Required */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Station *
                </label>
                <DebouncedInput
                  type="text"
                  value={formData.station}
                  onChange={handleInputChange('station')}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter station name"
                  required
                />
              </div>

              {/* Call Sign */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Call Sign
                </label>
                <DebouncedInput
                  type="text"
                  value={formData.callSign}
                  onChange={handleInputChange('callSign')}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., WNCT, KABC"
                  maxLength={10}
                />
              </div>

              {/* Rate */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rate
                </label>
                <RateInput
                  value={formData.rate}
                  onChange={handleInputChange('rate')}
                  placeholder="500"
                />
              </div>

              {/* TAT (Turn Around Time) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  TAT
                </label>
                <DebouncedInput
                  type="text"
                  value={formData.tat}
                  onChange={handleInputChange('tat')}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., 2-4 Weeks"
                />
              </div>

              {/* Sponsored */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sponsored
                </label>
                <DebouncedInput
                  type="text"
                  value={formData.sponsored}
                  onChange={handleInputChange('sponsored')}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Yes, No"
                />
              </div>

              {/* Indexed */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Indexed
                </label>
                <DebouncedInput
                  type="text"
                  value={formData.indexed}
                  onChange={handleInputChange('indexed')}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Yes, No"
                />
              </div>

              {/* Segment Length */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Segment Length
                </label>
                <DebouncedInput
                  type="text"
                  value={formData.segmentLength}
                  onChange={handleInputChange('segmentLength')}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., 2-4 minutes"
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location
                </label>
                <DebouncedInput
                  type="text"
                  value={formData.location}
                  onChange={handleInputChange('location')}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Studio, Satellite"
                />
              </div>

              {/* Program Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Program Name
                </label>
                <DebouncedInput
                  type="text"
                  value={formData.programName}
                  onChange={handleInputChange('programName')}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Morning Show, 102"
                />
              </div>

              {/* Interview Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Interview Type
                </label>
                <DebouncedInput
                  type="text"
                  value={formData.interviewType}
                  onChange={handleInputChange('interviewType')}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Zoom, In Person"
                />
              </div>
            </div>

            {/* Example URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Example URL
              </label>
              <DebouncedInput
                type="url"
                value={formData.exampleUrl}
                onChange={handleInputChange('exampleUrl')}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="https://example.com/video"
                pattern="https?://.+"
                title="Enter a valid URL starting with http:// or https://"
              />
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
                disabled={isSubmitting || !formData.station.trim()}
              >
                {isSubmitting ? 'Saving...' : (isEditMode ? 'Update Record' : 'Add Record')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}


