'use client'

import { useState, useRef, useEffect } from 'react'

interface DualRangeSliderProps {
  min: number
  max: number
  minValue: number | null
  maxValue: number | null
  step?: number
  onChange: (min: number | null, max: number | null) => void
  label?: string
}

export default function DualRangeSlider({
  min,
  max,
  minValue,
  maxValue,
  step = 1,
  onChange,
  label
}: DualRangeSliderProps) {
  const [minVal, setMinVal] = useState<number>(minValue || min)
  const [maxVal, setMaxVal] = useState<number>(maxValue || max)
  const minValRef = useRef<HTMLInputElement>(null)
  const maxValRef = useRef<HTMLInputElement>(null)
  const range = useRef<HTMLDivElement>(null)

  // Convert to number
  const getPercent = (value: number) => Math.round(((value - min) / (max - min)) * 100)

  // Set width of the range to decrease from the left side
  useEffect(() => {
    if (maxValref.current) {
      const minPercent = getPercent(minVal)
      const maxPercent = getPercent(+maxValref.current.value)

      if (range.current) {
        range.current.style.left = `${minPercent}%`
        range.current.style.width = `${maxPercent - minPercent}%`
      }
    }
  }, [minVal, getPercent])

  // Set width of the range to decrease from the right side
  useEffect(() => {
    if (minValref.current) {
      const minPercent = getPercent(+minValref.current.value)
      const maxPercent = getPercent(maxVal)

      if (range.current) {
        range.current.style.width = `${maxPercent - minPercent}%`
      }
    }
  }, [maxVal, getPercent])

  // Update parent when values change
  useEffect(() => {
    onChange(minVal === min ? null : minVal, maxVal === max ? null : maxVal)
  }, [minVal, maxVal, min, max, onChange])

  return (
    <div className="w-full">
      <style dangerouslySetInnerHTML={{__html: `
        .dual-range-slider input[type="range"] {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 8px;
          background: transparent;
        }
        .dual-range-slider input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #4f46e5;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        .dual-range-slider input[type="range"]::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #4f46e5;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        .dual-range-slider input[type="range"]::-webkit-slider-thumb:hover {
          background: #4338ca;
        }
        .dual-range-slider input[type="range"]::-moz-range-thumb:hover {
          background: #4338ca;
        }
      `}} />
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}
      <div className="relative w-full dual-range-slider">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={minVal}
          ref={minValRef}
          onChange={(event) => {
            const value = Math.min(+event.target.value, maxVal - step)
            setMinVal(value)
            event.target.value = value.toString()
          }}
          className="absolute w-full h-2 bg-transparent appearance-none pointer-events-auto cursor-pointer"
          style={{ zIndex: minVal > max - 100 ? 20 : 10 }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={maxVal}
          ref={maxValRef}
          onChange={(event) => {
            const value = Math.max(+event.target.value, minVal + step)
            setMaxVal(value)
            event.target.value = value.toString()
          }}
          className="absolute w-full h-2 bg-transparent appearance-none pointer-events-auto cursor-pointer"
          style={{ zIndex: 10 }}
        />

        <div className="relative w-full">
          <div className="absolute w-full h-2 bg-gray-200 rounded-md"></div>
          <div
            ref={range}
            className="absolute h-2 bg-indigo-600 rounded-md"
          ></div>
          <div className="absolute w-full flex justify-between text-xs text-gray-500 mt-2">
            <span>${min}</span>
            <span>${max}</span>
          </div>
        </div>
      </div>
      <div className="flex justify-between mt-4">
        <div className="flex-1 mr-2">
          <label className="block text-xs text-gray-500 mb-1">Min Price</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500 text-sm">$</span>
            </div>
            <input
              type="number"
              min={min}
              max={max}
              step={step}
              value={minVal === min ? '' : minVal}
              onChange={(e) => {
                const value = e.target.value === '' ? min : Math.min(Math.max(+e.target.value, min), maxVal - step)
                setMinVal(value)
              }}
              placeholder={`${min}`}
              className="block w-full pl-7 pr-3 border border-gray-300 rounded-md shadow-sm py-2 text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>
        <div className="flex-1 ml-2">
          <label className="block text-xs text-gray-500 mb-1">Max Price</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500 text-sm">$</span>
            </div>
            <input
              type="number"
              min={min}
              max={max}
              step={step}
              value={maxVal === max ? '' : maxVal}
              onChange={(e) => {
                const value = e.target.value === '' ? max : Math.max(Math.min(+e.target.value, max), minVal + step)
                setMaxVal(value)
              }}
              placeholder={`${max}`}
              className="block w-full pl-7 pr-3 border border-gray-300 rounded-md shadow-sm py-2 text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

