/**
 * Utility functions for handling price adjustments in UI components
 */

/**
 * Parse price from "$X,XXX" format to number
 */
export function parsePriceString(priceStr: string): number | null {
  if (!priceStr) return null
  const cleaned = priceStr.replace(/[$,]/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

/**
 * Check if price adjustments apply to a given price
 */
export function isPriceAdjusted(priceStr: string | number, priceAdjustments: any): boolean {
  if (!priceAdjustments) return false
  
  // Parse price if it's a string
  let price: number
  if (typeof priceStr === 'string') {
    const parsed = parsePriceString(priceStr)
    if (parsed === null) return false
    price = parsed
  } else {
    price = priceStr
  }
  
  const { global, user } = priceAdjustments
  
  // Check global adjustments (handle both array and single object)
  let globalApplies = false
  if (global) {
    const globalAdjs = Array.isArray(global) ? global : [global]
    globalApplies = globalAdjs.some((adj: any) => {
      if (!adj) return false
      const withinGlobalRange = 
        (adj.min_price === null || adj.min_price === undefined || price >= adj.min_price) &&
        (adj.max_price === null || adj.max_price === undefined || price <= adj.max_price)
      return withinGlobalRange && (adj.adjustment_percentage !== 0 || (adj.exact_amount !== null && adj.exact_amount !== undefined))
    })
  }
  
  // Check user adjustments (handle both array and single object)
  let userApplies = false
  if (user) {
    const userAdjs = Array.isArray(user) ? user : [user]
    userApplies = userAdjs.some((adj: any) => {
      if (!adj) return false
      const withinUserRange = 
        (adj.min_price === null || adj.min_price === undefined || price >= adj.min_price) &&
        (adj.max_price === null || adj.max_price === undefined || price <= adj.max_price)
      return withinUserRange && (adj.adjustment_percentage !== 0 || (adj.exact_amount !== null && adj.exact_amount !== undefined))
    })
  }
  
  return globalApplies || userApplies
}

/**
 * Get adjustment details for display (includes both global and user)
 */
export function getAdjustmentInfo(priceAdjustments: any): string {
  if (!priceAdjustments) return ''
  
  const { global, user } = priceAdjustments
  const parts: string[] = []
  
  // Handle global adjustments (array or single)
  if (global) {
    const globalAdjs = Array.isArray(global) ? global : [global]
    globalAdjs.forEach((adj: any) => {
      if (adj && (adj.adjustment_percentage !== 0 || (adj.exact_amount !== null && adj.exact_amount !== undefined))) {
        let text = 'Global: '
        if (adj.exact_amount !== null && adj.exact_amount !== undefined) {
          text += `$${adj.exact_amount}`
        } else {
          text += `${adj.adjustment_percentage > 0 ? '+' : ''}${adj.adjustment_percentage}%`
        }
        if (adj.min_price || adj.max_price) {
          text += ` ($${adj.min_price || '0'}-$${adj.max_price || '∞'})`
        }
        parts.push(text)
      }
    })
  }
  
  // Handle user adjustments (array or single)
  if (user) {
    const userAdjs = Array.isArray(user) ? user : [user]
    userAdjs.forEach((adj: any) => {
      if (adj && (adj.adjustment_percentage !== 0 || (adj.exact_amount !== null && adj.exact_amount !== undefined))) {
        let text = 'User: '
        if (adj.exact_amount !== null && adj.exact_amount !== undefined) {
          text += `$${adj.exact_amount}`
        } else {
          text += `${adj.adjustment_percentage > 0 ? '+' : ''}${adj.adjustment_percentage}%`
        }
        if (adj.min_price || adj.max_price) {
          text += ` ($${adj.min_price || '0'}-$${adj.max_price || '∞'})`
        }
        parts.push(text)
      }
    })
  }
  
  return parts.join(', ')
}

/**
 * Get user-specific adjustment details only (hides global/wholesale margins)
 * This should be used for hover tooltips when displaying to users
 */
export function getUserAdjustmentInfo(priceAdjustments: any): string {
  if (!priceAdjustments) return ''
  
  const { user } = priceAdjustments
  const parts: string[] = []
  
  // Handle user adjustments only (array or single)
  if (user) {
    const userAdjs = Array.isArray(user) ? user : [user]
    userAdjs.forEach((adj: any) => {
      if (adj && (adj.adjustment_percentage !== 0 || (adj.exact_amount !== null && adj.exact_amount !== undefined))) {
        let text = ''
        if (adj.exact_amount !== null && adj.exact_amount !== undefined) {
          text += `$${adj.exact_amount}`
        } else {
          text += `${adj.adjustment_percentage > 0 ? '+' : ''}${adj.adjustment_percentage}%`
        }
        if (adj.min_price || adj.max_price) {
          text += ` ($${adj.min_price || '0'}-$${adj.max_price || '∞'})`
        }
        parts.push(text)
      }
    })
  }
  
  return parts.join(', ')
}

/**
 * Check if any adjustments are active
 */
export function hasActiveAdjustments(priceAdjustments: any): boolean {
  if (!priceAdjustments) return false
  const { global, user } = priceAdjustments
  
  // Check global adjustments
  if (global) {
    const globalAdjs = Array.isArray(global) ? global : [global]
    if (globalAdjs.some((adj: any) => adj && (adj.adjustment_percentage !== 0 || (adj.exact_amount !== null && adj.exact_amount !== undefined)))) {
      return true
    }
  }
  
  // Check user adjustments
  if (user) {
    const userAdjs = Array.isArray(user) ? user : [user]
    if (userAdjs.some((adj: any) => adj && (adj.adjustment_percentage !== 0 || (adj.exact_amount !== null && adj.exact_amount !== undefined)))) {
      return true
    }
  }
  
  return false
}
