import { getSupabaseClient } from './supabase'
import { getAdminClient } from './admin-client'

/**
 * Get price adjustments for a user and table
 * Returns both global and user-specific adjustments as arrays
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
      .order('created_at', { ascending: true })
  ]

  if (userId) {
    queries.push(
      adminClient
        .from('user_price_adjustments')
        .select('adjustment_percentage, min_price, max_price, exact_amount')
        .eq('user_id', userId)
        .eq('table_name', tableName)
        .order('created_at', { ascending: true })
    )
  }

  const results = await Promise.all(queries)
  const [globalResult, userResult] = results

  if (globalResult.error && globalResult.error.code !== 'PGRST116') {
    // PGRST116 is "not found" which is fine, but log other errors
    console.warn(`⚠️ [Price Adjustments] Error fetching global adjustments for ${tableName}:`, globalResult.error.message)
  }

  if (userResult?.error) {
    if (userResult.error.code === 'PGRST116') {
      // Not found is fine - user just doesn't have custom adjustments
      console.log(`ℹ️ [Price Adjustments] No user-specific adjustments found for user ${userId} on ${tableName}`)
    } else {
      console.warn(`⚠️ [Price Adjustments] Error fetching user adjustments for ${tableName} (user: ${userId}):`, userResult.error.message)
    }
  }

  const globalAdjs = globalResult.data || []
  const userAdjs = userResult?.data || []

  return {
    global: globalAdjs,
    user: userAdjs
  }
}

/**
 * Apply price adjustments to a value with price range support
 * Handles multiple adjustments by selecting the most specific matching range
 * If exact_amount is set, it replaces the price instead of applying percentage
 */
export function applyPriceAdjustment(
  basePrice: number, 
  adjustments: { 
    global: Array<{ adjustment_percentage: number; min_price: number | null; max_price: number | null; exact_amount: number | null }> | { adjustment_percentage: number; min_price: number | null; max_price: number | null; exact_amount: number | null } | number;
    user: Array<{ adjustment_percentage: number; min_price: number | null; max_price: number | null; exact_amount: number | null }> | { adjustment_percentage: number; min_price: number | null; max_price: number | null; exact_amount: number | null } | number;
  }
): number {
  let adjustedPrice = basePrice;
  
  // Helper function to check if price is within range
  const isWithinRange = (
    price: number,
    min_price: number | null,
    max_price: number | null
  ): boolean => {
    // Handle null as unlimited (no constraint)
    // Handle 0 as a specific minimum value (not unlimited)
    const minCheck = min_price === null || price >= min_price;
    const maxCheck = max_price === null || price <= max_price;
    return minCheck && maxCheck;
  };
  
  // Helper function to calculate range specificity (smaller range = more specific)
  const getRangeSpecificity = (
    min_price: number | null,
    max_price: number | null
  ): number => {
    // If both are null, it's the least specific (infinite range)
    if (min_price === null && max_price === null) {
      return Infinity;
    }
    // If one is null, use a very large number for specificity calculation
    const min = min_price === null ? 0 : min_price;
    const max = max_price === null ? Number.MAX_SAFE_INTEGER : max_price;
    // Return range size (smaller = more specific)
    return max - min;
  };
  
  // Helper function to find the most specific matching adjustment
  const findMostSpecificAdjustment = (
    adjs: Array<{ adjustment_percentage: number; min_price: number | null; max_price: number | null; exact_amount: number | null }>,
    currentPrice: number
  ): { adjustment_percentage: number; min_price: number | null; max_price: number | null; exact_amount: number | null } | null => {
    const matchingAdjs = adjs.filter(adj => {
      if (!adj) return false;
      const hasAdjustment = adj.adjustment_percentage !== 0 || (adj.exact_amount !== null && adj.exact_amount !== undefined);
      return hasAdjustment && isWithinRange(currentPrice, adj.min_price, adj.max_price);
    });
    
    if (matchingAdjs.length === 0) return null;
    
    // Find the most specific (smallest range)
    let mostSpecific = matchingAdjs[0];
    let mostSpecificRange = getRangeSpecificity(mostSpecific.min_price, mostSpecific.max_price);
    
    for (let i = 1; i < matchingAdjs.length; i++) {
      const range = getRangeSpecificity(matchingAdjs[i].min_price, matchingAdjs[i].max_price);
      if (range < mostSpecificRange) {
        mostSpecific = matchingAdjs[i];
        mostSpecificRange = range;
      }
    }
    
    return mostSpecific;
  };
  
  // Helper function to apply a single adjustment
  const applySingleAdjustment = (
    adj: { adjustment_percentage: number; min_price: number | null; max_price: number | null; exact_amount: number | null },
    currentPrice: number,
    type: 'global' | 'user'
  ): number => {
    // Check if price is within range
    const withinRange = isWithinRange(currentPrice, adj.min_price, adj.max_price);
    
    if (withinRange) {
      // If exact_amount is set, replace the price
      if (adj.exact_amount !== null && adj.exact_amount !== undefined) {
        // For user adjustments with exact_amount, only apply if it's >= current price (which already has global adjustments)
        // This ensures user exact amounts don't reduce prices below global adjustment levels
        if (type === 'user' && adj.exact_amount < currentPrice) {
          return currentPrice;
        }
        return adj.exact_amount;
      } 
      // Otherwise apply percentage adjustment
      else if (adj.adjustment_percentage !== 0) {
        return currentPrice * (1 + adj.adjustment_percentage / 100);
      }
    }
    
    return currentPrice;
  };
  
  // Handle global adjustments (find most specific match)
  if (Array.isArray(adjustments.global) && adjustments.global.length > 0) {
    // Multiple global adjustments - find the most specific matching one
    const mostSpecificGlobal = findMostSpecificAdjustment(adjustments.global, adjustedPrice);
    if (mostSpecificGlobal) {
      adjustedPrice = applySingleAdjustment(mostSpecificGlobal, adjustedPrice, 'global');
    }
  } else if (typeof adjustments.global === 'object' && adjustments.global !== null && !Array.isArray(adjustments.global)) {
    // Single global adjustment (legacy support)
    adjustedPrice = applySingleAdjustment(adjustments.global as { adjustment_percentage: number; min_price: number | null; max_price: number | null; exact_amount: number | null }, adjustedPrice, 'global');
  } else if (typeof adjustments.global === 'number') {
    // Legacy support for number type
    adjustedPrice = adjustedPrice * (1 + adjustments.global / 100);
  }
  
  // Handle user adjustments (find most specific match)
  if (Array.isArray(adjustments.user) && adjustments.user.length > 0) {
    // Multiple user adjustments - find the most specific matching one
    const mostSpecificUser = findMostSpecificAdjustment(adjustments.user, adjustedPrice);
    if (mostSpecificUser) {
      adjustedPrice = applySingleAdjustment(mostSpecificUser, adjustedPrice, 'user');
    }
  } else if (typeof adjustments.user === 'object' && adjustments.user !== null && !Array.isArray(adjustments.user)) {
    // Single user adjustment (legacy support)
    adjustedPrice = applySingleAdjustment(adjustments.user as { adjustment_percentage: number; min_price: number | null; max_price: number | null; exact_amount: number | null }, adjustedPrice, 'user');
  } else if (typeof adjustments.user === 'number') {
    // Legacy support for number type
    adjustedPrice = adjustedPrice * (1 + adjustments.user / 100);
  }
  
  return Math.round(adjustedPrice);
}

/**
 * Helper function to find applicable adjustment for a given price
 */
function findApplicableAdjustmentForPrice(
  adjs: Array<{ adjustment_percentage: number; min_price: number | null; max_price: number | null; exact_amount: number | null }> | null,
  price: number
): { adjustment_percentage: number; min_price: number | null; max_price: number | null; exact_amount: number | null } | null {
  if (!adjs || !Array.isArray(adjs) || adjs.length === 0) return null
  
  const isWithinRange = (p: number, min: number | null, max: number | null): boolean => {
    const minCheck = min === null || p >= min
    const maxCheck = max === null || p <= max
    return minCheck && maxCheck
  }
  
  const matching = adjs.filter(adj => {
    if (!adj) return false
    const hasAdjustment = adj.adjustment_percentage !== 0 || (adj.exact_amount !== null && adj.exact_amount !== undefined)
    return hasAdjustment && isWithinRange(price, adj.min_price, adj.max_price)
  })
  
  if (matching.length === 0) return null
  
  // Return the most specific (smallest range)
  return matching.reduce((best, current) => {
    const bestRange = (best.max_price ?? Infinity) - (best.min_price ?? 0)
    const currentRange = (current.max_price ?? Infinity) - (current.min_price ?? 0)
    return currentRange < bestRange ? current : best
  })
}

/**
 * Apply adjustment to a price based on the main price's applicable adjustment
 * This allows niche prices to be adjusted even if they fall outside the price range
 */
function applyAdjustmentBasedOnMainPrice(
  nichePrice: number,
  mainPrice: number,
  adjustments: any
): number {
  if (!adjustments) return nichePrice
  
  // Find applicable global and user adjustments based on main price
  const globalAdj = findApplicableAdjustmentForPrice(adjustments.global, mainPrice)
  const userAdj = findApplicableAdjustmentForPrice(adjustments.user, mainPrice)
  
  // If no adjustments apply to main price, return niche price unchanged
  if (!globalAdj && !userAdj) {
    return nichePrice
  }
  
  let adjusted = nichePrice
  
  // Apply global adjustment
  if (globalAdj) {
    if (globalAdj.exact_amount !== null && globalAdj.exact_amount !== undefined) {
      // For exact amount, calculate the ratio and apply it to niche price
      const ratio = globalAdj.exact_amount / mainPrice
      adjusted = adjusted * ratio
    } else if (globalAdj.adjustment_percentage !== 0) {
      adjusted = adjusted * (1 + globalAdj.adjustment_percentage / 100)
    }
  }
  
  // Apply user adjustment on top
  if (userAdj) {
    if (userAdj.exact_amount !== null && userAdj.exact_amount !== undefined) {
      // For user exact amount, calculate ratio based on what user adjustment does to main price
      const mainAfterGlobal = globalAdj 
        ? (globalAdj.exact_amount !== null ? globalAdj.exact_amount : mainPrice * (1 + (globalAdj.adjustment_percentage || 0) / 100))
        : mainPrice
      if (userAdj.exact_amount >= mainAfterGlobal) {
        const ratio = userAdj.exact_amount / mainAfterGlobal
        adjusted = adjusted * ratio
      }
    } else if (userAdj.adjustment_percentage !== 0) {
      adjusted = adjusted * (1 + userAdj.adjustment_percentage / 100)
    }
  }
  
  return Math.round(adjusted)
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

    // Get the base price (first price in defaultPrice array) for determining niche adjustments
    let basePrice: number | null = null
    if (updated.defaultPrice && Array.isArray(updated.defaultPrice) && updated.defaultPrice.length > 0) {
      const firstPrice = updated.defaultPrice[0]
      const numPrice = typeof firstPrice === 'string' ? parseFloat(firstPrice) : firstPrice
      basePrice = (numPrice !== null && numPrice !== undefined && !isNaN(numPrice)) ? numPrice : null
    }

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

    // Adjust eroticPrice based on whether the base price qualifies for an adjustment
    // This ensures erotic price gets adjusted even if it falls outside the price range
    if (updated.eroticPrice !== null && updated.eroticPrice !== undefined) {
      if (basePrice !== null) {
        // Apply adjustment based on main price qualification
        updated.eroticPrice = applyAdjustmentBasedOnMainPrice(updated.eroticPrice, basePrice, adjustments)
      } else {
        // Fallback to regular adjustment if no base price
        updated.eroticPrice = applyPriceAdjustment(updated.eroticPrice, adjustments)
      }
    }

    // Store the adjustment info for niche multipliers to use in the frontend
    // The frontend calculates niche prices as basePrice * multiplier
    // Since basePrice is already adjusted, the multiplied result will also be adjusted
    // We just need to ensure eroticPrice (which has a direct price) is adjusted properly

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

/**
 * Adjust prices in niches string format: "Health: $75, CBD: $75, Crypto: $75"
 */
export function adjustNichesPrice(
  nichesStr: string | null,
  adjustments: any
): string | null {
  if (!nichesStr) return nichesStr
  
  // Match patterns like "$75" or "$1,500" within the niches string
  const result = nichesStr.replace(/\$[\d,]+/g, (match) => {
    const numPrice = parseDollarPrice(match)
    if (numPrice === null) return match
    const adjusted = applyPriceAdjustment(numPrice, adjustments)
    return formatDollarPrice(adjusted)
  })
  
  return result
}

/**
 * Adjust niche prices based on the main price's adjustment.
 * If the main price qualifies for an adjustment, apply the same adjustment to all niche prices
 * regardless of whether the niche prices fall within the adjustment's price range.
 */
export function adjustNichesPriceBasedOnMainPrice(
  nichesStr: string | null,
  mainPriceStr: string | null,
  adjustments: any
): string | null {
  if (!nichesStr) return nichesStr
  if (!adjustments) return nichesStr
  
  // Parse the main price to determine which adjustment applies
  const mainPrice = mainPriceStr ? parseDollarPrice(mainPriceStr) : null
  if (mainPrice === null) {
    // If we can't determine main price, fall back to regular adjustment
    return adjustNichesPrice(nichesStr, adjustments)
  }
  
  // Find the adjustment that would apply to the main price
  const findApplicableAdjustment = (
    adjs: Array<{ adjustment_percentage: number; min_price: number | null; max_price: number | null; exact_amount: number | null }> | null,
    price: number
  ) => {
    if (!adjs || !Array.isArray(adjs) || adjs.length === 0) return null
    
    const isWithinRange = (p: number, min: number | null, max: number | null): boolean => {
      const minCheck = min === null || p >= min
      const maxCheck = max === null || p <= max
      return minCheck && maxCheck
    }
    
    const matching = adjs.filter(adj => {
      if (!adj) return false
      const hasAdjustment = adj.adjustment_percentage !== 0 || (adj.exact_amount !== null && adj.exact_amount !== undefined)
      return hasAdjustment && isWithinRange(price, adj.min_price, adj.max_price)
    })
    
    if (matching.length === 0) return null
    
    // Return the most specific (smallest range)
    return matching.reduce((best, current) => {
      const bestRange = (best.max_price ?? Infinity) - (best.min_price ?? 0)
      const currentRange = (current.max_price ?? Infinity) - (current.min_price ?? 0)
      return currentRange < bestRange ? current : best
    })
  }
  
  // Find applicable global and user adjustments based on main price
  const globalAdj = findApplicableAdjustment(adjustments.global, mainPrice)
  const userAdj = findApplicableAdjustment(adjustments.user, mainPrice)
  
  // If no adjustments apply to main price, return niches unchanged
  if (!globalAdj && !userAdj) {
    return nichesStr
  }
  
  // Apply the found adjustments to all niche prices (ignoring their individual price ranges)
  const result = nichesStr.replace(/\$[\d,]+/g, (match) => {
    const numPrice = parseDollarPrice(match)
    if (numPrice === null) return match
    
    let adjusted = numPrice
    
    // Apply global adjustment
    if (globalAdj) {
      if (globalAdj.exact_amount !== null && globalAdj.exact_amount !== undefined) {
        // For exact amount, calculate the ratio and apply it to niche price
        // e.g., if main price goes from $1000 to $2000 (exact), that's 2x, so apply 2x to niches
        const ratio = globalAdj.exact_amount / mainPrice
        adjusted = adjusted * ratio
      } else if (globalAdj.adjustment_percentage !== 0) {
        adjusted = adjusted * (1 + globalAdj.adjustment_percentage / 100)
      }
    }
    
    // Apply user adjustment on top
    if (userAdj) {
      if (userAdj.exact_amount !== null && userAdj.exact_amount !== undefined) {
        // For user exact amount, calculate ratio based on what user adjustment does to main price
        const mainAfterGlobal = globalAdj 
          ? (globalAdj.exact_amount !== null ? globalAdj.exact_amount : mainPrice * (1 + (globalAdj.adjustment_percentage || 0) / 100))
          : mainPrice
        if (userAdj.exact_amount >= mainAfterGlobal) {
          const ratio = userAdj.exact_amount / mainAfterGlobal
          adjusted = adjusted * ratio
        }
      } else if (userAdj.adjustment_percentage !== 0) {
        adjusted = adjusted * (1 + userAdj.adjustment_percentage / 100)
      }
    }
    
    return formatDollarPrice(Math.round(adjusted))
  })
  
  return result
}


