import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/admin-client'

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

// GET - Fetch admin settings (specifically the logo)
export async function GET(request: Request) {
  try {
    const adminClient = getAdminClient()
    
    const { data, error } = await adminClient
      .from('admin_settings')
      .select('setting_key, setting_value')
      .eq('setting_key', 'admin_logo')
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching admin settings:', error)
      return NextResponse.json({ error: 'Failed to fetch admin settings' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      logo_url: data?.setting_value || null 
    })
  } catch (error: any) {
    console.error('Error fetching admin settings:', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch admin settings' }, { status: 500 })
  }
}

// POST - Upload admin logo
export async function POST(request: Request) {
  try {
    const { isAdmin, userId } = await checkAdmin(request)
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

    // Generate unique filename
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 15)
    const fileExt = file.name.split('.').pop() || 'png'
    const fileName = `admin-logo-${timestamp}-${randomString}.${fileExt}`
    
    const adminClient = getAdminClient()
    
    console.log('📤 Uploading admin logo:', fileName, 'Size:', file.size, 'Type:', file.type)
    
    // Convert File to ArrayBuffer for upload
    const arrayBuffer = await file.arrayBuffer()
    
    // First, try to delete any existing admin logo files to keep storage clean
    try {
      const { data: existingFiles } = await adminClient.storage
        .from('admin-assets')
        .list('', {
          search: 'admin-logo'
        })
      
      if (existingFiles && existingFiles.length > 0) {
        const filesToDelete = existingFiles.map((f: { name: string }) => f.name)
        await adminClient.storage
          .from('admin-assets')
          .remove(filesToDelete)
        console.log('🗑️ Deleted old admin logo files:', filesToDelete)
      }
    } catch (deleteError) {
      console.log('⚠️ Could not delete old logo files:', deleteError)
      // Continue anyway - not critical
    }
    
    // Upload the new logo
    const { data: uploadData, error: uploadError } = await adminClient.storage
      .from('admin-assets')
      .upload(fileName, arrayBuffer, {
        contentType: file.type,
        upsert: true,
        cacheControl: '3600'
      })

    if (uploadError) {
      console.error('❌ Storage upload error:', uploadError)
      
      // Check if bucket doesn't exist
      if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('not found')) {
        return NextResponse.json({ 
          error: 'Storage bucket "admin-assets" not found. Please create it in Supabase Storage.',
          details: 'Go to Supabase Dashboard > Storage > Create bucket named "admin-assets" (make it public)'
        }, { status: 404 })
      }
      
      return NextResponse.json({ 
        error: uploadError.message || 'Failed to upload file'
      }, { status: 500 })
    }

    console.log('✅ Admin logo uploaded successfully:', uploadData)

    // Get the public URL
    const { data: urlData } = adminClient.storage
      .from('admin-assets')
      .getPublicUrl(fileName)

    const logoUrl = urlData.publicUrl

    // Save the logo URL to admin_settings table
    const { error: settingsError } = await adminClient
      .from('admin_settings')
      .upsert({
        setting_key: 'admin_logo',
        setting_value: logoUrl,
        updated_at: new Date().toISOString(),
        updated_by: userId
      }, {
        onConflict: 'setting_key'
      })

    if (settingsError) {
      console.error('❌ Error saving admin settings:', settingsError)
      return NextResponse.json({ 
        error: 'Logo uploaded but failed to save settings',
        details: settingsError.message
      }, { status: 500 })
    }

    console.log('✅ Admin logo URL saved to settings:', logoUrl)

    return NextResponse.json({ 
      success: true, 
      logo_url: logoUrl
    })
  } catch (error: any) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: error.message || 'Failed to upload file' }, { status: 500 })
  }
}

// DELETE - Reset admin logo to default
export async function DELETE(request: Request) {
  try {
    const { isAdmin, userId } = await checkAdmin(request)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = getAdminClient()

    // Delete the logo files from storage
    try {
      const { data: existingFiles } = await adminClient.storage
        .from('admin-assets')
        .list('', {
          search: 'admin-logo'
        })
      
      if (existingFiles && existingFiles.length > 0) {
        const filesToDelete = existingFiles.map((f: { name: string }) => f.name)
        await adminClient.storage
          .from('admin-assets')
          .remove(filesToDelete)
        console.log('🗑️ Deleted admin logo files:', filesToDelete)
      }
    } catch (deleteError) {
      console.log('⚠️ Could not delete logo files from storage:', deleteError)
    }

    // Reset the setting to null
    const { error: settingsError } = await adminClient
      .from('admin_settings')
      .upsert({
        setting_key: 'admin_logo',
        setting_value: null,
        updated_at: new Date().toISOString(),
        updated_by: userId
      }, {
        onConflict: 'setting_key'
      })

    if (settingsError) {
      console.error('❌ Error resetting admin settings:', settingsError)
      return NextResponse.json({ 
        error: 'Failed to reset logo setting',
        details: settingsError.message
      }, { status: 500 })
    }

    console.log('✅ Admin logo reset to default')

    return NextResponse.json({ 
      success: true, 
      message: 'Logo reset to default'
    })
  } catch (error: any) {
    console.error('Delete error:', error)
    return NextResponse.json({ error: error.message || 'Failed to reset logo' }, { status: 500 })
  }
}
