'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import PricingTabs from '@/components/PricingTabs'
import BroadcastMessagePopup from '@/components/BroadcastMessagePopup'
import { createClient } from '@/lib/supabase-client'

export default function Home() {
  const router = useRouter()
  // Use useMemo to ensure we get the same client instance
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session) {
          router.push('/login')
          return
        }

        setUser(session.user)

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          if (!session) {
            router.push('/login')
          } else {
            setUser(session.user)
          }
        })

        setLoading(false)

        return () => subscription.unsubscribe()
      } catch (error) {
        console.error('Auth check error:', error)
        router.push('/login')
      }
    }

    checkAuth()
  }, [router, supabase])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (!user) {
    return null // Will redirect to login
  }

  return (
    <div className="__variable_a59c88">
      <div 
        style={{
          position: 'fixed',
          zIndex: 9999,
          top: '16px',
          left: '16px',
          right: '16px',
          bottom: '16px',
          pointerEvents: 'none'
        }}
      />
      <Header />
      <main className="w-full p-2 lg:w-full lg:p-4 lg:mx-auto xl:p-[2] 2xl:w-[1650px]">
        <section className="mt-2 mb-4 flex-col font-body space-y-3 flex lg:space-y-0 lg:items-center lg:flex-row justify-between">
          <div className="flex flex-col">
            <h1 className="text-2xl uppercase bold">Pricing (Hotshot Social)</h1>
            <p className="text-sm">
              Once we have published the article for you, any further edits may include an extra charge.
            </p>
            <p className="text-sm">
              Hotshot Social Agency will use reasonable good faith efforts to ensure that such article will remain publicly available in the applicable publication for at least 12 months.
            </p>
          </div>
          <div className="flex space-x-2">
            {/* <a
              href="https://www.loom.com/share/ee69b887e5574fad9b5342c4d9c80f15?sid=3328344c-b5d4-4a50-85d1-eba58c2f816d"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-primary p-2 px-2 text-white font-body text-sm"
            >
              Video Tutorial
            </a> */}
            {/* <a
              href="https://www.figma.com/proto/0VHlTHQ0nY19KcyvrSwcCG/Hotshot Social-Pricing-Portal?type=design&node-id=1-2&t=4SMS3QL3VksDvURV-0&scaling=contain&page-id=0%3A1"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-primary p-2 px-2 text-white font-body text-sm"
            >
              How To
            </a> */}
            <a
              href="https://docs.google.com/document/d/1fMHASfp2its2jacTJyxN2LYiG6ABhNKup0WGsaOrlHk/edit?usp=sharing"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-primary p-2 px-2 text-white font-body text-sm"
            >
              Download PR Questionnaire
            </a>
            {/* <a
              href="https://docs.google.com/document/d/19et1cFZnL6DS8tX6P95c41wbJwYdAHvdHhqzGkBxIeY/edit?usp=sharing"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-primary p-2 px-2 text-white font-body text-sm"
            >
              Download TV Questionnaire
            </a> */}
          </div>
        </section>
        <PricingTabs />
      </main>
      <BroadcastMessagePopup />
    </div>
  )
}

