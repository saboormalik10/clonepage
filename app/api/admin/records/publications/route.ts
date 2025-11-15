import { NextResponse } from 'next/server'
import { getAdminClient, retryWithBackoff } from '@/lib/admin-client'

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
        .from('publications')
        .select('*')
        .order('name', { ascending: true })
    )

    if (error) throw error

    return NextResponse.json({ records: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { isAdmin } = await checkAdmin(request)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    console.log('📥 [Publications API] Received data:', JSON.stringify(body, null, 2))
    console.log('📄 [Publications API] Article preview received:', JSON.stringify(body.article_preview))
    
    // Validate required fields
    if (!body.name || body.name.trim() === '') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    
    const adminClient = getAdminClient()

    const { data, error } = await retryWithBackoff(
      async () => await adminClient
        .from('publications')
        .insert(body)
        .select()
        .single()
    )

    if (error) {
      console.error('❌ [Publications API] Insert error:', error)
      console.error('❌ [Publications API] Error code:', error.code)
      console.error('❌ [Publications API] Error message:', error.message)
      console.error('❌ [Publications API] Error details:', error.details)
      console.error('❌ [Publications API] Error hint:', error.hint)
      throw error
    }

    console.log('✅ [Publications API] Record created:', data)
    console.log('📄 [Publications API] Article preview in saved record:', JSON.stringify(data?.article_preview))
    return NextResponse.json({ success: true, record: data })
  } catch (error: any) {
    console.error('❌ [Publications API] Error:', error)
    const errorMessage = error.message || 'Failed to create record'
    const errorDetails = error.details || error.hint || null
    return NextResponse.json({ 
      error: errorMessage, 
      details: errorDetails,
      code: error.code 
    }, { status: 500 })
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
    console.log('📥 [Publications API] Update data:', JSON.stringify(body, null, 2))
    
    // Validate required fields
    if (!body.name || body.name.trim() === '') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    
    const adminClient = getAdminClient()

    // Remove _id from update body as it shouldn't be updated
    const { _id, ...updateData } = body

    const { data, error } = await retryWithBackoff(
      async () => await adminClient
        .from('publications')
        .update(updateData)
        .eq('_id', id)
        .select()
        .single()
    )

    if (error) {
      console.error('❌ [Publications API] Update error:', error)
      throw error
    }

    console.log('✅ [Publications API] Record updated:', data)
    return NextResponse.json({ success: true, record: data })
  } catch (error: any) {
    console.error('❌ [Publications API] Update error:', error)
    const errorMessage = error.message || 'Failed to update record'
    const errorDetails = error.details || error.hint || null
    return NextResponse.json({ 
      error: errorMessage, 
      details: errorDetails,
      code: error.code 
    }, { status: 500 })
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
    // Publications table uses _id as primary key
    // Return the deleted record ID so client can update state without refetching
    const { error } = await retryWithBackoff(
      async () => await adminClient
        .from('publications')
        .delete()
        .eq('_id', id)
    )

    if (error) throw error

    return NextResponse.json({ success: true, deletedId: id })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

