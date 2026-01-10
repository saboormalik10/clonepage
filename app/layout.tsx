import type { Metadata } from 'next'
import { Oswald } from 'next/font/google'
import './globals.css'
import { AdminProvider } from '@/contexts/AdminContext'

const oswald = Oswald({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
})

export const metadata: Metadata = {
  title: 'Vexis Collective',
  description: 'Vexis Collective Pricing Portal',
  applicationName: 'Vexis Collective',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Vexis',
  },
  icons: {
    icon: [
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
      { url: '/app-icon-1024x1024.png', sizes: '1024x1024', type: 'image/png' },
    ],
    apple: [
      { url: '/app-icon-180x180.png', sizes: '180x180', type: 'image/png' },
      { url: '/app-icon-1024x1024.png', sizes: '1024x1024', type: 'image/png' },
    ],
  },
  manifest: '/manifest.json',
  themeColor: '#4f46e5',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: 'cover',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/app-icon-180x180.png" />
        <link rel="apple-touch-icon" sizes="1024x1024" href="/app-icon-1024x1024.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192x192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512x512.png" />
        <link rel="icon" type="image/png" sizes="1024x1024" href="/app-icon-1024x1024.png" />
      </head>
      <body className={`${oswald.variable} font-body`}>
        <AdminProvider>
          {children}
        </AdminProvider>
      </body>
    </html>
  )
}

