import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Fetch all records from a Supabase table using pagination
 * Supabase has a default limit of 1000 rows, so we need to paginate to get all records
 */
export async function fetchAllRecords<T = any>(
  supabase: SupabaseClient,
  tableName: string,
  options: {
    select?: string
    orderBy?: string
    ascending?: boolean
    batchSize?: number
  } = {}
): Promise<T[]> {
  const {
    select = '*',
    orderBy,
    ascending = true,
    batchSize = 1000
  } = options

  let allData: T[] = []
  let from = 0
  let hasMore = true

  while (hasMore) {
    let query = supabase
      .from(tableName)
      .select(select)
      .range(from, from + batchSize - 1)

    if (orderBy) {
      query = query.order(orderBy, { ascending })
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    if (data && data.length > 0) {
      allData = [...allData, ...(data as T[])]
      
      // If we got fewer records than the batch size, we've reached the end
      if (data.length < batchSize) {
        hasMore = false
      } else {
        from += batchSize
      }
    } else {
      hasMore = false
    }
  }

  return allData
}

