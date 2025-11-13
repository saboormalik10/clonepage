'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

export default function AuthCallback() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the hash from URL (Supabase uses hash fragments for auth callbacks)
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const error = hashParams.get('error')
        const errorDescription = hashParams.get('error_description')
        const accessToken = hashParams.get('access_token')
        const type = hashParams.get('type')

        // Also check query params (some flows use query params)
        const queryError = searchParams.get('error')
        const queryErrorDescription = searchParams.get('error_description')
        const queryErrorCode = searchParams.get('error_code')

        if (error || queryError) {
          const errorMsg = errorDescription || queryErrorDescription || error || queryError
          const errorCode = queryErrorCode || hashParams.get('error_code')

          if (errorCode === 'otp_expired' || errorMsg?.includes('expired')) {
            setStatus('error')
            setMessage('The email confirmation link has expired. Please request a new email change from the settings page.')
          } else if (errorCode === 'access_denied') {
            setStatus('error')
            setMessage('Access denied. The confirmation link may be invalid or expired.')
          } else {
            setStatus('error')
            setMessage(errorMsg || 'An error occurred during email confirmation.')
          }
          return
        }

        // If we have an access token, try to exchange it for a session
        if (accessToken || type === 'email_change') {
          // Supabase should automatically handle the session exchange
          // Wait a moment for Supabase to process the callback
          await new Promise(resolve => setTimeout(resolve, 1000))

          // Check if we have a session
          const { data: { session }, error: sessionError } = await supabase.auth.getSession()

          if (sessionError) {
            setStatus('error')
            setMessage(sessionError.message || 'Failed to establish session.')
            return
          }

          if (session) {
            setStatus('success')
            setMessage('Email confirmed successfully! Redirecting to settings...')
            
            // Redirect to admin settings after 2 seconds
            setTimeout(() => {
              router.push('/admin/settings')
            }, 2000)
            return
          }
        }

        // If no error and no token, might be a different callback type
        setStatus('success')
        setMessage('Processing...')
        setTimeout(() => {
          router.push('/admin/settings')
        }, 1000)
      } catch (err: any) {
        setStatus('error')
        setMessage(err.message || 'An unexpected error occurred.')
      }
    }

    handleCallback()
  }, [router, searchParams, supabase])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
        {status === 'loading' && (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Processing email confirmation...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="mt-4 text-lg font-medium text-gray-900">Success!</h2>
            <p className="mt-2 text-sm text-gray-600">{message}</p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="mt-4 text-lg font-medium text-gray-900">Error</h2>
            <p className="mt-2 text-sm text-gray-600">{message}</p>
            <div className="mt-6">
              <button
                onClick={() => router.push('/admin/settings')}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Go to Settings
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

