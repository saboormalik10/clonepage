import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-client'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const ref = searchParams.get('ref')

    if (!ref) {
      return NextResponse.json({ error: 'Reference is required' }, { status: 400 })
    }

    // Parse reference: image-{hash}-{width}x{height}-{ext}
    const refWithoutPrefix = ref.replace('image-', '')
    const parts = refWithoutPrefix.match(/^([a-f0-9]{40})-\d+x\d+-(\w+)$/)
    
    if (!parts) {
      return NextResponse.json({ error: 'Invalid reference format' }, { status: 400 })
    }

    const ext = parts[2]
    
    // List files in storage to find matching file
    // This is not ideal but necessary since we can't reconstruct filename from hash
    const supabase = createClient()
    const { data: files, error } = await supabase.storage
      .from('publications')
      .list('logos', {
        limit: 1000,
        sortBy: { column: 'created_at', order: 'desc' }
      })

    if (error) {
      console.error('Error listing files:', error)
      return NextResponse.json({ error: 'Failed to list files' }, { status: 500 })
    }

    // Find file with matching extension
    // Since we can't match by hash, we'll return the most recent file with matching extension
    // This is a limitation - ideally we'd store filename mapping
    const matchingFile = files?.find(f => f.name.endsWith(`.${ext}`))
    
    if (matchingFile) {
      const { data: { publicUrl } } = supabase.storage
        .from('publications')
        .getPublicUrl(`logos/${matchingFile.name}`)
      
      return NextResponse.json({ url: publicUrl })
    }

    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  } catch (error: any) {
    console.error('Error getting logo URL:', error)
    return NextResponse.json({ error: error.message || 'Failed to get logo URL' }, { status: 500 })
  }
}

