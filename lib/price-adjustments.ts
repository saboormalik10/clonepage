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

  console.log(`💰 [Price Adjustments] Fetched for ${tableName} (user: ${userId || 'none'}): ${globalAdjs.length} global, ${userAdjs.length} user adjustments`)

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
        console.log(`💵 Replacing price $${currentPrice} with exact amount $${adj.exact_amount} (${type})`)
        return adj.exact_amount;
      } 
      // Otherwise apply percentage adjustment
      else if (adj.adjustment_percentage !== 0) {
        console.log(`💵 Applying ${type} adjustment ${adj.adjustment_percentage}% to price $${currentPrice} (within range $${adj.min_price ?? '0'}-$${adj.max_price ?? 'unlimited'})`)
        return currentPrice * (1 + adj.adjustment_percentage / 100);
      }
    } else if (adj.adjustment_percentage !== 0 || (adj.exact_amount !== null && adj.exact_amount !== undefined)) {
      console.log(`⏭️ Skipping ${type} adjustment for price $${currentPrice} (outside range $${adj.min_price ?? '0'}-$${adj.max_price ?? 'unlimited'})`)
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
  } else if (typeof adjustments.global === 'object' && adjustments.global !== null) {
    // Single global adjustment (legacy support)
    adjustedPrice = applySingleAdjustment(adjustments.global, adjustedPrice, 'global');
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
  } else if (typeof adjustments.user === 'object' && adjustments.user !== null) {
    // Single user adjustment (legacy support)
    adjustedPrice = applySingleAdjustment(adjustments.user, adjustedPrice, 'user');
  } else if (typeof adjustments.user === 'number') {
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


