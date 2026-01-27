import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/admin-client'

// Get the authenticated user from the token
async function getAuthenticatedUser(request: Request) {
  const authHeader = request.headers.get('authorization')
  
  if (!authHeader) {
    return { user: null, error: 'No authorization header' }
  }

  const token = authHeader.replace('Bearer ', '')
  
  try {
    const adminClient = getAdminClient()
    
    const { data: { user }, error } = await adminClient.auth.getUser(token)

    if (error || !user) {
      return { user: null, error: 'Invalid token or user not found' }
    }

    return { user, error: null }
  } catch (error: any) {
    console.error('Error getting authenticated user:', error)
    return { user: null, error: error.message }
  }
}

export async function POST(request: Request) {
  try {
    const { user, error: authError } = await getAuthenticatedUser(request)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Only images are allowed.' }, { status: 400 })
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File size exceeds 5MB limit' }, { status: 400 })
    }

    // Generate unique filename
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 15)
    const fileExt = file.name.split('.').pop() || 'png'
    const fileName = `${user.id}-${timestamp}-${randomString}.${fileExt}`
    
    // Use user-logos folder for user-uploaded brand logos
    const folder = 'user-logos'
    
    // Upload to Supabase Storage using admin client for proper permissions
    const adminClient = getAdminClient()
    
    console.log('📤 User uploading brand logo:', fileName, 'Size:', file.size, 'Type:', file.type)
    
    // Convert File to ArrayBuffer for upload
    const arrayBuffer = await file.arrayBuffer()
    
    try {
      const { data, error } = await adminClient.storage
        .from('publications')
        .upload(`${folder}/${fileName}`, arrayBuffer, {
          contentType: file.type,
          upsert: false,
          cacheControl: '3600'
        })

      if (error) {
        console.error('❌ Storage upload error:', error)
        
        // Check if bucket doesn't exist
        if (error.message?.includes('Bucket not found') || (error as any).statusCode === '404' || error.message?.includes('not found')) {
          return NextResponse.json({ 
            error: 'Storage bucket not found. Please contact administrator.',
          }, { status: 404 })
        }
        
        return NextResponse.json({ 
          error: error.message || 'Failed to upload file',
        }, { status: 500 })
      }

      console.log('✅ Brand logo uploaded successfully:', data)
    } catch (uploadError: any) {
      console.error('❌ Upload exception:', uploadError)
      return NextResponse.json({ 
        error: uploadError.message || 'Failed to upload file',
      }, { status: 500 })
    }

    // Get the public URL for the uploaded file
    const { data: { publicUrl } } = adminClient.storage
      .from('publications')
      .getPublicUrl(`${folder}/${fileName}`)

    return NextResponse.json({ 
      success: true, 
      publicUrl,
      fileName,
      storagePath: `${folder}/${fileName}`
    })
  } catch (error: any) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: error.message || 'Failed to upload file' }, { status: 500 })
  }
}
