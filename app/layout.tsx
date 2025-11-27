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
  title: 'Hotshot',
  description: 'Hotshot Social Pricing Portal',
  applicationName: 'Hotshot',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Hotshot',
  },
  icons: {
    icon: [
      { url: '/logo.jpeg', sizes: '192x192', type: 'image/png' },
      { url: '/logo.jpeg', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/logo.jpeg', sizes: '180x180', type: 'image/png' },
      { url: '/logo.jpeg', sizes: '152x152', type: 'image/png' },
      { url: '/logo.jpeg', sizes: '144x144', type: 'image/png' },
      { url: '/logo.jpeg', sizes: '120x120', type: 'image/png' },
      { url: '/logo.jpeg', sizes: '114x114', type: 'image/png' },
      { url: '/logo.jpeg', sizes: '76x76', type: 'image/png' },
      { url: '/logo.jpeg', sizes: '72x72', type: 'image/png' },
      { url: '/logo.jpeg', sizes: '60x60', type: 'image/png' },
      { url: '/logo.jpeg', sizes: '57x57', type: 'image/png' },
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
  other: {
    'apple-touch-icon': '/logo.jpeg',
    'apple-touch-icon-precomposed': '/logo.jpeg',
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
        <link rel="apple-touch-icon" sizes="180x180" href="/logo.jpeg" />
        <link rel="apple-touch-icon" sizes="152x152" href="/logo.jpeg" />
        <link rel="apple-touch-icon" sizes="144x144" href="/logo.jpeg" />
        <link rel="apple-touch-icon" sizes="120x120" href="/logo.jpeg" />
        <link rel="apple-touch-icon" sizes="114x114" href="/logo.jpeg" />
        <link rel="apple-touch-icon" sizes="76x76" href="/logo.jpeg" />
        <link rel="apple-touch-icon" sizes="72x72" href="/logo.jpeg" />
        <link rel="apple-touch-icon" sizes="60x60" href="/logo.jpeg" />
        <link rel="apple-touch-icon" sizes="57x57" href="/logo.jpeg" />
        <link rel="apple-touch-icon" href="/logo.jpeg" />
      </head>
      <body className={`${oswald.variable} font-body`}>
        <AdminProvider>
          {children}
        </AdminProvider>
      </body>
    </html>
  )
}

