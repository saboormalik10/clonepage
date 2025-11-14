import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/admin-client'
import { createClient } from '@/lib/supabase-client'

// Check if user is admin
async function checkAdmin(request: Request) {
  const authHeader = request.headers.get('authorization')
  
  if (!authHeader) {
    return { isAdmin: false, userId: null }
  }

  const token = authHeader.replace('Bearer ', '')
  
  try {
    const adminClient = getAdminClient()
    
    const { data: { user }, error } = await adminClient.auth.getUser(token)

    if (error || !user) {
      return { isAdmin: false, userId: null }
    }

    const { data: profile } = await adminClient
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    
    return {
      isAdmin: profile?.role === 'admin',
      userId: user.id
    }
  } catch (error: any) {
    console.error('Error in checkAdmin:', error)
    return { isAdmin: false, userId: null }
  }
}

export async function POST(request: Request) {
  try {
    const { isAdmin } = await checkAdmin(request)
    if (!isAdmin) {
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

    // Generate unique filename that we can store for later retrieval
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 15)
    const fileExt = file.name.split('.').pop() || 'png'
    const fileName = `${timestamp}-${randomString}.${fileExt}`
    
    // Determine folder based on context (default to logos for publications)
    // Can be extended to support different folders (listicles, best-sellers, etc.)
    const folder = 'logos' // Using same folder for all images in publications bucket
    
    // Upload to Supabase Storage using admin client for proper permissions
    const adminClient = getAdminClient()
    
    console.log('📤 Uploading file to storage:', fileName, 'Size:', file.size, 'Type:', file.type)
    console.log('📤 Storage bucket: publications, Path: ' + folder + '/' + fileName)
    
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
        console.error('Error code:', (error as any).statusCode)
        console.error('Error message:', error.message)
        console.error('Error details:', JSON.stringify(error, null, 2))
        
        // Check if bucket doesn't exist
        if (error.message?.includes('Bucket not found') || (error as any).statusCode === '404' || error.message?.includes('not found')) {
          return NextResponse.json({ 
            error: 'Storage bucket "publications" not found. Please create it in Supabase Storage.',
            details: 'Go to Supabase Dashboard > Storage > Create bucket named "publications"'
          }, { status: 404 })
        }
        
        return NextResponse.json({ 
          error: error.message || 'Failed to upload file',
          details: error,
          code: (error as any).statusCode
        }, { status: 500 })
      }

      console.log('✅ File uploaded successfully:', data)
    } catch (uploadError: any) {
      console.error('❌ Upload exception:', uploadError)
      return NextResponse.json({ 
        error: uploadError.message || 'Failed to upload file',
        details: uploadError.toString()
      }, { status: 500 })
    }

    // Generate a 40-character hash similar to Sanity format
    // Example: image-83f2052837ecd04193a9e3859613ba60d1363af1-400x300-png
    const crypto = await import('crypto')
    const hashInput = `${timestamp}${randomString}${fileName}`
    const hashBuffer = crypto.createHash('sha1').update(hashInput).digest()
    const hash = hashBuffer.toString('hex').substring(0, 40) // 40 character hash
    
    // Get image dimensions (default to 400x300, can be enhanced later)
    const width = 400
    const height = 300
    
    // Generate reference in the exact format as existing logos
    // Format: image-{40-char-hash}-{width}x{height}-{ext}
    // We'll embed the filename info in the hash input so we can extract it later
    // For Supabase uploads, we'll use a special prefix in the hash to identify them
    const ref = `image-${hash}-${width}x${height}-${fileExt}`

    // Store in exact format as requested (without url field)
    // But we'll store the filename in a way we can retrieve it
    // We'll use the timestamp and randomString to reconstruct the filename
    const logoReference = {
      _type: 'image',
      asset: {
        _ref: ref,
        _type: 'reference',
        // Store filename metadata (not in the format, but accessible)
        // We'll use this to construct the Supabase URL
        _metadata: {
          filename: fileName,
          storagePath: `${folder}/${fileName}`,
          isSupabaseUpload: true
        }
      }
    }
    
    console.log('📸 Logo reference created:', JSON.stringify(logoReference))
    console.log('📸 Storage filename:', fileName)
    console.log('📸 Hash:', hash)

    return NextResponse.json({ 
      success: true, 
      logo: logoReference
    })
  } catch (error: any) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: error.message || 'Failed to upload file' }, { status: 500 })
  }
}

