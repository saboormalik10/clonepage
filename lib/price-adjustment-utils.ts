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
  
  // Check global adjustment
  let globalApplies = false
  if (global) {
    const withinGlobalRange = 
      (global.min_price === null || global.min_price === undefined || price >= global.min_price) &&
      (global.max_price === null || global.max_price === undefined || price <= global.max_price)
    globalApplies = withinGlobalRange && global.adjustment_percentage !== 0
  }
  
  // Check user adjustment
  let userApplies = false
  if (user) {
    const withinUserRange = 
      (user.min_price === null || user.min_price === undefined || price >= user.min_price) &&
      (user.max_price === null || user.max_price === undefined || price <= user.max_price)
    userApplies = withinUserRange && user.adjustment_percentage !== 0
  }
  
  return globalApplies || userApplies
}

/**
 * Get adjustment details for display
 */
export function getAdjustmentInfo(priceAdjustments: any): string {
  if (!priceAdjustments) return ''
  
  const { global, user } = priceAdjustments
  const parts = []
  
  if (global && global.adjustment_percentage !== 0) {
    let text = `Global: ${global.adjustment_percentage > 0 ? '+' : ''}${global.adjustment_percentage}%`
    if (global.min_price || global.max_price) {
      text += ` ($${global.min_price || '0'}-$${global.max_price || '∞'})`
    }
    parts.push(text)
  }
  
  if (user && user.adjustment_percentage !== 0) {
    let text = `User: ${user.adjustment_percentage > 0 ? '+' : ''}${user.adjustment_percentage}%`
    if (user.min_price || user.max_price) {
      text += ` ($${user.min_price || '0'}-$${user.max_price || '∞'})`
    }
    parts.push(text)
  }
  
  return parts.join(', ')
}

/**
 * Check if any adjustments are active
 */
export function hasActiveAdjustments(priceAdjustments: any): boolean {
  if (!priceAdjustments) return false
  const { global, user } = priceAdjustments
  return (global?.adjustment_percentage !== 0) || (user?.adjustment_percentage !== 0)
}
