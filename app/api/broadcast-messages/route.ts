import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { getAdminClient } from '@/lib/admin-client'

// GET - Fetch unread messages for the current user
export async function GET(request: Request) {
  try {
    // Require authentication
    const authResult = await requireAuth(request)
    if (authResult instanceof Response) {
      return authResult // Return 401 if not authenticated
    }
    
    const userId = authResult.userId

    // Use admin client to bypass RLS, but we'll filter by user_id for security
    const adminClient = getAdminClient()

    // Fetch unread messages for this user
    // Using admin client to bypass RLS on the join
    const { data, error } = await adminClient
      .from('broadcast_message_recipients')
      .select(`
        id,
        message_id,
        is_closed,
        broadcast_messages (
          id,
          title,
          message,
          created_at
        )
      `)
      .eq('user_id', userId)
      .eq('is_closed', false)

    if (error) {
      console.error('Error fetching messages:', error)
      throw error
    }

    // Transform the data to a simpler format
    const messages = (data || [])
      .map((item: any) => {
        // Handle case where broadcast_messages might be an array or object
        const messageData = Array.isArray(item.broadcast_messages) 
          ? item.broadcast_messages[0] 
          : item.broadcast_messages
        
        return {
          recipientId: item.id,
          messageId: item.message_id,
          title: messageData?.title,
          message: messageData?.message,
          createdAt: messageData?.created_at,
          isClosed: item.is_closed
        }
      })
      .filter((msg: any) => msg.title && msg.message) // Filter out any null messages
      .sort((a: any, b: any) => {
        // Sort by message created_at descending (newest first)
        const dateA = new Date(a.createdAt || 0).getTime()
        const dateB = new Date(b.createdAt || 0).getTime()
        return dateB - dateA
      })

    return NextResponse.json({ messages })
  } catch (error: any) {
    console.error('Error in broadcast messages API:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to fetch messages',
      details: error.details || null
    }, { status: 500 })
  }
}

// PATCH - Mark a message as closed
export async function PATCH(request: Request) {
  try {
    // Require authentication
    const authResult = await requireAuth(request)
    if (authResult instanceof Response) {
      return authResult // Return 401 if not authenticated
    }
    
    const userId = authResult.userId

    const body = await request.json()
    const { recipientId } = body

    if (!recipientId) {
      return NextResponse.json({ error: 'Recipient ID is required' }, { status: 400 })
    }

    // Use admin client to bypass RLS, but we filter by user_id for security
    const adminClient = getAdminClient()

    // Update the recipient record to mark as closed
    const { data, error } = await adminClient
      .from('broadcast_message_recipients')
      .update({ 
        is_closed: true,
        closed_at: new Date().toISOString()
      })
      .eq('id', recipientId)
      .eq('user_id', userId) // Ensure user can only close their own messages
      .select()
      .single()

    if (error) {
      console.error('Error closing message:', error)
      throw error
    }

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in close message API:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to close message' 
    }, { status: 500 })
  }
}

