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

// GET - Fetch all broadcast messages (for admin)
export async function GET(request: Request) {
  try {
    const { isAdmin } = await checkAdmin(request)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = getAdminClient()
    
    const { data, error } = await retryWithBackoff(
      async () => await adminClient
        .from('broadcast_messages')
        .select('*')
        .order('created_at', { ascending: false })
    )

    if (error) throw error

    return NextResponse.json({ messages: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Create and send a broadcast message
export async function POST(request: Request) {
  try {
    const { isAdmin, userId } = await checkAdmin(request)
    if (!isAdmin || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { title, message, sendToAll, userIds } = body

    // Validate required fields
    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    if (sendToAll !== true && (!userIds || !Array.isArray(userIds) || userIds.length === 0)) {
      return NextResponse.json({ error: 'Either send to all or specify at least one user' }, { status: 400 })
    }

    const adminClient = getAdminClient()

    // Create the message
    const { data: messageData, error: messageError } = await retryWithBackoff(
      async () => await adminClient
        .from('broadcast_messages')
        .insert({
          title: title.trim(),
          message: message.trim(),
          created_by: userId,
          send_to_all: sendToAll === true
        })
        .select()
        .single()
    )

    if (messageError) {
      console.error('Error creating message:', messageError)
      throw messageError
    }

    // Create recipients
    if (sendToAll === true) {
      // Get all users
      const { data: allUsers, error: usersError } = await retryWithBackoff(
        async () => await adminClient.auth.admin.listUsers()
      )

      if (usersError) {
        console.error('Error fetching users:', usersError)
        throw usersError
      }

      // Create recipient records for all users
      if (allUsers && allUsers.users && allUsers.users.length > 0) {
        const recipients = allUsers.users.map((user: any) => ({
          message_id: messageData.id,
          user_id: user.id
        }))

        const { error: recipientsError } = await retryWithBackoff(
          async () => await adminClient
            .from('broadcast_message_recipients')
            .insert(recipients)
        )

        if (recipientsError) {
          console.error('Error creating recipients:', recipientsError)
          // Don't throw, message is already created
        }
      }
    } else {
      // Create recipient records for specific users
      const recipients = userIds.map((uid: string) => ({
        message_id: messageData.id,
        user_id: uid
      }))

      const { error: recipientsError } = await retryWithBackoff(
        async () => await adminClient
          .from('broadcast_message_recipients')
          .insert(recipients)
      )

      if (recipientsError) {
        console.error('Error creating recipients:', recipientsError)
        throw recipientsError
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: messageData 
    })
  } catch (error: any) {
    console.error('Error creating broadcast message:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to create broadcast message' 
    }, { status: 500 })
  }
}

// DELETE - Delete a broadcast message and its dependent records
export async function DELETE(request: Request) {
  try {
    const { isAdmin } = await checkAdmin(request)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const messageId = searchParams.get('id')

    if (!messageId) {
      return NextResponse.json({ error: 'Message ID is required' }, { status: 400 })
    }

    const adminClient = getAdminClient()

    // Delete the message - CASCADE will automatically delete all dependent records
    // (broadcast_message_recipients) due to ON DELETE CASCADE in the foreign key constraint
    const { error: deleteError } = await retryWithBackoff(
      async () => await adminClient
        .from('broadcast_messages')
        .delete()
        .eq('id', messageId)
    )

    if (deleteError) {
      console.error('Error deleting broadcast message:', deleteError)
      throw deleteError
    }

    console.log(`✅ [Broadcast Messages API] Deleted message ${messageId} and all dependent recipient records (via CASCADE)`)

    return NextResponse.json({ 
      success: true, 
      deletedId: messageId 
    })
  } catch (error: any) {
    console.error('Error deleting broadcast message:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to delete broadcast message' 
    }, { status: 500 })
  }
}

