import { NextResponse } from 'next/server'
import { getAdminClient, retryWithBackoff } from '@/lib/admin-client'
import { getPriceAdjustments, adjustListiclesPrice } from '@/lib/price-adjustments'
import { dataCache, CACHE_KEYS } from '@/lib/cache'

// Check if user is admin
async function checkAdmin(request: Request) {
  const authHeader = request.headers.get('authorization')
  
  if (!authHeader) {
    return { isAdmin: false, userId: null }
  }

  const token = authHeader.replace('Bearer ', '')
  
  try {
    const adminClient = getAdminClient()
    
    const { data: { user }, error } = await retryWithBackoff(
      () => adminClient.auth.getUser(token)
    )

    if (error || !user) {
      return { isAdmin: false, userId: null }
    }

    const profileResult = await retryWithBackoff(
      async () => await adminClient
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()
    )
    
    const profile = profileResult?.data

    return {
      isAdmin: profile?.role === 'admin',
      userId: user.id
    }
  } catch (error: any) {
    console.error('Error in checkAdmin:', error)
    return { isAdmin: false, userId: null }
  }
}

export async function GET(request: Request) {
  try {
    const { isAdmin } = await checkAdmin(request)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = getAdminClient()
    const { data, error } = await retryWithBackoff(
      async () => await adminClient
        .from('listicles')
        .select('*')
        .order('publication', { ascending: true })
    )

    if (error) throw error

    return NextResponse.json({ records: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { isAdmin, userId } = await checkAdmin(request)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const adminClient = getAdminClient()

    const { data, error } = await retryWithBackoff(
      async () => await adminClient
        .from('listicles')
        .insert(body)
        .select()
        .single()
    )

    if (error) throw error

    // Invalidate cache after insert
    dataCache.invalidate(CACHE_KEYS.LISTICLES)

    // Apply price adjustments to the newly created record
    let adjustedRecord = data
    try {
      const adjustments = await getPriceAdjustments(userId, 'listicles')
      if (adjustments) {
        adjustedRecord = {
          ...data,
          price: adjustListiclesPrice(data.price, adjustments)
        }
        console.log('✅ [Listicles API] Applied price adjustments to new record')
      }
    } catch (adjError) {
      console.warn('⚠️ [Listicles API] Error applying price adjustments:', adjError)
      // Continue without adjustments if there's an error
    }

    return NextResponse.json({ success: true, record: adjustedRecord })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { isAdmin } = await checkAdmin(request)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const adminClient = getAdminClient()

    // Remove id from update body as it shouldn't be updated
    const { id: _, ...updateData } = body

    const { data, error } = await retryWithBackoff(
      async () => await adminClient
        .from('listicles')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()
    )

    if (error) throw error

    // Invalidate cache after update
    dataCache.invalidate(CACHE_KEYS.LISTICLES)

    return NextResponse.json({ success: true, record: data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { isAdmin } = await checkAdmin(request)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    const adminClient = getAdminClient()
    // Return the deleted record ID so client can update state without refetching
    const { error } = await retryWithBackoff(
      async () => await adminClient
        .from('listicles')
        .delete()
        .eq('id', id)
    )

    if (error) throw error

    // Invalidate cache after delete
    dataCache.invalidate(CACHE_KEYS.LISTICLES)

    return NextResponse.json({ success: true, deletedId: id })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

