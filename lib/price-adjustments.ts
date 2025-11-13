import { getSupabaseClient } from './supabase'
import { getAdminClient } from './admin-client'

/**
 * Get price adjustments for a user and table
 * Returns both global and user-specific adjustments
 * Uses admin client to bypass RLS for reliable access
 */
export async function getPriceAdjustments(userId: string | null, tableName: string) {
  // Use admin client to bypass RLS (we're in server-side API routes)
  const adminClient = getAdminClient()
  
  // Run queries in parallel for better performance
  const queries = [
    adminClient
      .from('global_price_adjustments')
      .select('adjustment_percentage, min_price, max_price, exact_amount')
      .eq('table_name', tableName)
      .single()
  ]

  if (userId) {
    queries.push(
      adminClient
        .from('user_price_adjustments')
        .select('adjustment_percentage, min_price, max_price, exact_amount')
        .eq('user_id', userId)
        .eq('table_name', tableName)
        .single()
    )
  }

  const results = await Promise.all(queries)
  const [globalResult, userResult] = results

  if (globalResult.error && globalResult.error.code !== 'PGRST116') {
    // PGRST116 is "not found" which is fine, but log other errors
    console.warn(`⚠️ [Price Adjustments] Error fetching global adjustment for ${tableName}:`, globalResult.error.message)
  }

  if (userResult?.error) {
    if (userResult.error.code === 'PGRST116') {
      // Not found is fine - user just doesn't have a custom adjustment
      console.log(`ℹ️ [Price Adjustments] No user-specific adjustment found for user ${userId} on ${tableName}`)
    } else {
      console.warn(`⚠️ [Price Adjustments] Error fetching user adjustment for ${tableName} (user: ${userId}):`, userResult.error.message)
    }
  }

  const globalAdj = globalResult.data || { adjustment_percentage: 0, min_price: null, max_price: null, exact_amount: null }
  const userAdj = userResult?.data || { adjustment_percentage: 0, min_price: null, max_price: null, exact_amount: null }

  console.log(`💰 [Price Adjustments] Fetched for ${tableName} (user: ${userId || 'none'}): Global ${globalAdj.exact_amount ? `$${globalAdj.exact_amount}` : `${globalAdj.adjustment_percentage}%`}, User ${userAdj.exact_amount ? `$${userAdj.exact_amount}` : `${userAdj.adjustment_percentage}%`}`)

  return {
    global: globalAdj,
    user: userAdj
  }
}

/**
 * Apply price adjustments to a value with price range support
 * If exact_amount is set, it replaces the price instead of applying percentage
 */
export function applyPriceAdjustment(
  basePrice: number, 
  adjustments: { 
    global: { adjustment_percentage: number; min_price: number | null; max_price: number | null; exact_amount: number | null } | number;
    user: { adjustment_percentage: number; min_price: number | null; max_price: number | null; exact_amount: number | null } | number;
  }
): number {
  let adjustedPrice = basePrice;
  
  // Handle global adjustment
  if (typeof adjustments.global === 'object') {
    // Check if price is within range
    const withinRange = 
      (adjustments.global.min_price === null || basePrice >= adjustments.global.min_price) &&
      (adjustments.global.max_price === null || basePrice <= adjustments.global.max_price);
    
    if (withinRange) {
      // If exact_amount is set, replace the price
      if (adjustments.global.exact_amount !== null && adjustments.global.exact_amount !== undefined) {
        console.log(`💵 Replacing price $${basePrice} with exact amount $${adjustments.global.exact_amount} (global)`)
        adjustedPrice = adjustments.global.exact_amount;
      } 
      // Otherwise apply percentage adjustment
      else if (adjustments.global.adjustment_percentage !== 0) {
        console.log(`💵 Applying global adjustment ${adjustments.global.adjustment_percentage}% to price $${basePrice} (within range $${adjustments.global.min_price}-$${adjustments.global.max_price})`)
        adjustedPrice = adjustedPrice * (1 + adjustments.global.adjustment_percentage / 100);
      }
    } else if (!withinRange && (adjustments.global.adjustment_percentage !== 0 || (adjustments.global.exact_amount !== null && adjustments.global.exact_amount !== undefined))) {
      console.log(`⏭️ Skipping global adjustment for price $${basePrice} (outside range $${adjustments.global.min_price}-$${adjustments.global.max_price})`)
    }
  } else {
    // Legacy support for number type
    adjustedPrice = adjustedPrice * (1 + adjustments.global / 100);
  }
  
  // Handle user adjustment
  if (typeof adjustments.user === 'object') {
    // Check if price is within range
    const withinRange = 
      (adjustments.user.min_price === null || adjustedPrice >= adjustments.user.min_price) &&
      (adjustments.user.max_price === null || adjustedPrice <= adjustments.user.max_price);
    
    if (withinRange) {
      // If exact_amount is set, replace the price
      if (adjustments.user.exact_amount !== null && adjustments.user.exact_amount !== undefined) {
        console.log(`💵 Replacing price $${adjustedPrice} with exact amount $${adjustments.user.exact_amount} (user)`)
        adjustedPrice = adjustments.user.exact_amount;
      } 
      // Otherwise apply percentage adjustment
      else if (adjustments.user.adjustment_percentage !== 0) {
        console.log(`💵 Applying user adjustment ${adjustments.user.adjustment_percentage}% to price $${adjustedPrice} (within range $${adjustments.user.min_price}-$${adjustments.user.max_price})`)
        adjustedPrice = adjustedPrice * (1 + adjustments.user.adjustment_percentage / 100);
      }
    } else if (!withinRange && (adjustments.user.adjustment_percentage !== 0 || (adjustments.user.exact_amount !== null && adjustments.user.exact_amount !== undefined))) {
      console.log(`⏭️ Skipping user adjustment for price $${adjustedPrice} (outside range $${adjustments.user.min_price}-$${adjustments.user.max_price})`)
    }
  } else {
    // Legacy support for number type
    adjustedPrice = adjustedPrice * (1 + adjustments.user / 100);
  }
  
  return Math.round(adjustedPrice);
}

/**
 * Apply adjustments to publications data
 */
export function applyAdjustmentsToPublications(
  publications: any[],
  adjustments: any
): any[] {
  return publications.map(pub => {
    const updated = { ...pub }

    // Adjust defaultPrice array (handles both string and number arrays)
    if (updated.defaultPrice && Array.isArray(updated.defaultPrice)) {
      updated.defaultPrice = updated.defaultPrice.map((price: string | number) => {
        const numPrice = typeof price === 'string' ? parseFloat(price) : price
        if (isNaN(numPrice)) return price
        const adjusted = applyPriceAdjustment(numPrice, adjustments)
        return typeof price === 'string' ? adjusted.toString() : adjusted
      })
    }

    // Adjust customPrice array (handles both string and number arrays)
    if (updated.customPrice && Array.isArray(updated.customPrice)) {
      updated.customPrice = updated.customPrice.map((price: string | number) => {
        const numPrice = typeof price === 'string' ? parseFloat(price) : price
        if (isNaN(numPrice)) return price
        const adjusted = applyPriceAdjustment(numPrice, adjustments)
        return typeof price === 'string' ? adjusted.toString() : adjusted
      })
    }

    // Adjust eroticPrice
    if (updated.eroticPrice !== null && updated.eroticPrice !== undefined) {
      updated.eroticPrice = applyPriceAdjustment(updated.eroticPrice, adjustments)
    }

    // Adjust niche multipliers (they affect base price, so we adjust the multiplier effect)
    // Note: Multipliers are applied to base price, so we adjust the resulting price
    // This is handled at display time in the component

    return updated
  })
}

/**
 * Apply adjustments to simple price field (for other tables)
 */
export function applyAdjustmentsToPrice(
  price: string | number | null,
  adjustments: any
): string | number | null {
  if (price === null || price === undefined || price === '') {
    return price
  }

  const numericPrice = typeof price === 'string' ? parseFloat(price) : price
  if (isNaN(numericPrice)) {
    return price
  }

  const adjusted = applyPriceAdjustment(numericPrice, adjustments)
  return typeof price === 'string' ? adjusted.toString() : adjusted
}

/**
 * Parse price from format "$2,000" or "$750"
 */
function parseDollarPrice(priceStr: string): number | null {
  if (!priceStr) return null
  // Remove $ and commas, then parse
  const cleaned = priceStr.replace(/[$,]/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

/**
 * Format price back to "$2,000" format
 */
function formatDollarPrice(price: number): string {
  return `$${price.toLocaleString('en-US')}`
}

/**
 * Adjust price in "$2,000" format
 */
export function adjustDollarPrice(
  priceStr: string | null,
  adjustments: any
): string | null {
  if (!priceStr) return priceStr
  const numPrice = parseDollarPrice(priceStr)
  if (numPrice === null) return priceStr
  const adjusted = applyPriceAdjustment(numPrice, adjustments)
  return formatDollarPrice(adjusted)
}

/**
 * Adjust prices in listicles format: "Top 5: $4,500Top 10: $5,500"
 */
export function adjustListiclesPrice(
  priceStr: string | null,
  adjustments: any
): string | null {
  if (!priceStr) return priceStr
  
  // Match patterns like "Top 5: $4,500" or "Top 10: $5,500"
  return priceStr.replace(/\$[\d,]+/g, (match) => {
    const numPrice = parseDollarPrice(match)
    if (numPrice === null) return match
    const adjusted = applyPriceAdjustment(numPrice, adjustments)
    return formatDollarPrice(adjusted)
  })
}

/**
 * Adjust prices in PR bundles format
 */
export function adjustPRBundles(
  bundles: any[] | null,
  adjustments: any
): any[] | null {
  if (!bundles || !Array.isArray(bundles)) return bundles
  
  return bundles.map(bundle => {
    const updated = { ...bundle }
    
    // Adjust "Bundle 1 — $800" format in name
    if (updated.name && typeof updated.name === 'string') {
      updated.name = updated.name.replace(/\$[\d,]+/g, (match: string) => {
        const numPrice = parseDollarPrice(match)
        if (numPrice === null) return match
        const adjusted = applyPriceAdjustment(numPrice, adjustments)
        return formatDollarPrice(adjusted)
      })
    }
    
    // Adjust "Retail Value — $900" format in retailValue
    if (updated.retailValue && typeof updated.retailValue === 'string') {
      updated.retailValue = updated.retailValue.replace(/\$[\d,]+/g, (match: string) => {
        const numPrice = parseDollarPrice(match)
        if (numPrice === null) return match
        const adjusted = applyPriceAdjustment(numPrice, adjustments)
        return formatDollarPrice(adjusted)
      })
    }
    
    return updated
  })
}

/**
 * Adjust prices in print magazines format
 */
export function adjustPrintMagazines(
  magazines: any[] | null,
  adjustments: any
): any[] | null {
  if (!magazines || !Array.isArray(magazines)) return magazines
  
  return magazines.map(magazine => {
    const updated = { ...magazine }
    
    // Adjust prices in details array like "Full Page $7500"
    if (updated.details && Array.isArray(updated.details)) {
      updated.details = updated.details.map((detail: string) => {
        if (typeof detail === 'string') {
          return detail.replace(/\$[\d,]+/g, (match) => {
            const numPrice = parseDollarPrice(match)
            if (numPrice === null) return match
            const adjusted = applyPriceAdjustment(numPrice, adjustments)
            return formatDollarPrice(adjusted)
          })
        }
        return detail
      })
    }
    
    return updated
  })
}


