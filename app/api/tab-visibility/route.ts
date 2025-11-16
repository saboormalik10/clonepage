import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  try {
    console.log('📊 [Tab Visibility API] Fetching visible tabs...')
    const { data, error } = await supabase
      .from('tab_visibility')
      .select('tab_id, is_visible')
      .eq('is_visible', true)
      .order('tab_id', { ascending: true })

    if (error) {
      console.error('❌ [Tab Visibility API] Error fetching visible tabs:', error)
      // Return all tabs as visible if there's an error (fallback)
      return NextResponse.json({ 
        data: [
          { tab_id: 'publications', is_visible: true },
          { tab_id: 'broadcast', is_visible: true },
          { tab_id: 'digital', is_visible: true },
          { tab_id: 'listicles', is_visible: true },
          { tab_id: 'bestsellers', is_visible: true },
          { tab_id: 'print', is_visible: true },
          { tab_id: 'socialpost', is_visible: true },
          { tab_id: 'others', is_visible: true },
        ]
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      })
    }

    const visibleTabs = data || []
    console.log(`✅ [Tab Visibility API] Found ${visibleTabs.length} visible tabs:`, visibleTabs.map((t: any) => t.tab_id))

    return NextResponse.json({ data: visibleTabs }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    })
  } catch (error: any) {
    console.error('❌ [Tab Visibility API] Error in GET:', error)
    // Return all tabs as visible if there's an error (fallback)
    return NextResponse.json({ 
      data: [
        { tab_id: 'publications', is_visible: true },
        { tab_id: 'broadcast', is_visible: true },
        { tab_id: 'digital', is_visible: true },
        { tab_id: 'listicles', is_visible: true },
        { tab_id: 'bestsellers', is_visible: true },
        { tab_id: 'print', is_visible: true },
        { tab_id: 'socialpost', is_visible: true },
        { tab_id: 'others', is_visible: true },
      ]
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    })
  }
}

