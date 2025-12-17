// Simple in-memory cache with invalidation support
interface CacheEntry<T> {
  data: T
  timestamp: number
}

class DataCache {
  private cache: Map<string, CacheEntry<any>> = new Map()
  private ttl: number = 60 * 1000 // 1 minute default TTL

  set<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    })
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null
    
    // Check if entry has expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key)
      return null
    }
    
    return entry.data as T
  }

  invalidate(key: string): void {
    this.cache.delete(key)
    console.log(`🗑️ [Cache] Invalidated cache for: ${key}`)
  }

  invalidateAll(): void {
    this.cache.clear()
    console.log(`🗑️ [Cache] Invalidated all cache entries`)
  }

  // Invalidate all keys that start with a prefix
  invalidateByPrefix(prefix: string): void {
    Array.from(this.cache.keys()).forEach(key => {
      if (key.startsWith(prefix)) {
        this.cache.delete(key)
      }
    })
    console.log(`🗑️ [Cache] Invalidated cache entries with prefix: ${prefix}`)
  }
}

// Singleton instance
export const dataCache = new DataCache()

// Cache keys
export const CACHE_KEYS = {
  BEST_SELLERS: 'best_sellers',
  PUBLICATIONS: 'publications',
  SOCIAL_POSTS: 'social_posts',
  DIGITAL_TV: 'digital_tv',
  LISTICLES: 'listicles',
  PR_BUNDLES: 'pr_bundles',
  PRINT: 'print',
  BROADCAST_TV: 'broadcast_tv',
  OTHERS: 'others'
} as const
