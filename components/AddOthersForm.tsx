'use client'

import { useState, useCallback, useRef, useEffect, memo } from 'react'

interface Item {
  name: string
  description: string
}

interface FormData {
  category: string
  items: Item[]
}

interface AddOthersFormProps {
  onClose: () => void
  onSubmit: (data: FormData) => Promise<void>
  error?: string
  success?: string
  initialData?: any // Others data for edit mode
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


const getInitialFormData = (initialData?: any): FormData => {
  if (!initialData) {
    return {
      category: '',
      items: []
    }
  }

  // Handle migration from old format (bundles) to new format (items)
  if (initialData.bundles && !initialData.items) {
    // Convert old bundles format to new items format
    const items = initialData.bundles.map((bundle: any) => ({
      name: bundle.name && bundle.retailValue 
        ? `${bundle.name} — ${bundle.retailValue}`
        : bundle.name || bundle.retailValue || '',
      description: bundle.publications?.join(', ') || ''
    }))
    return {
      category: initialData.category || '',
      items: items
    }
  }

  return {
    category: initialData.category || '',
    items: initialData.items || []
  }
}

export default function AddOthersForm({ 
  onClose, 
  onSubmit, 
  error, 
  success, 
  initialData, 
  isEditMode = false 
}: AddOthersFormProps) {
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

  const handleAddItem = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { name: '', description: '' }]
    }))
  }, [])

  const handleRemoveItem = useCallback((index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }))
  }, [])

  const handleItemChange = useCallback((index: number, field: keyof Item, value: string) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
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
              {isEditMode ? 'Edit Others Category' : 'Add New Others Category'}
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

            {/* List */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  List
                </label>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="text-sm bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  + Add Item
                </button>
              </div>

              <div className="space-y-4">
                {formData.items.map((item, itemIndex) => (
                  <div key={itemIndex} className="border border-gray-300 rounded-md p-4 bg-gray-50">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-sm font-medium text-gray-700">Item {itemIndex + 1}</h3>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(itemIndex)}
                        className="text-sm text-red-600 hover:text-red-800 px-2 py-1 border border-red-600 rounded hover:bg-red-50"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="space-y-4">
                      {/* Item Name (merged name and retail value) */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Item Name
                        </label>
                        <DebouncedInput
                          type="text"
                          value={item.name}
                          onChange={(value) => handleItemChange(itemIndex, 'name', value || '')}
                          className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="e.g., Starter Bundle — $500"
                        />
                      </div>

                      {/* Description */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Description
                        </label>
                        <DebouncedInput
                          type="text"
                          value={item.description}
                          onChange={(value) => handleItemChange(itemIndex, 'description', value || '')}
                          className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Enter description"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {formData.items.length === 0 && (
                  <p className="text-sm text-gray-500 italic text-center py-4">No items added yet. Click &quot;Add Item&quot; to get started.</p>
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


