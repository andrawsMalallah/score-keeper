import type { Metadata, Viewport } from 'next'
import { Bricolage_Grotesque, Familjen_Grotesk, Spline_Sans_Mono } from 'next/font/google'
import './globals.css'
import { ThemeScript } from '@/components/shell/ThemeScript'
import { AuthGate } from '@/components/shell/AuthGate'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { Toaster } from '@/components/ui/Toaster'

/* Typography roles from REBUILD.md §6.2. */

/** Display: wordmark, victory modal, section titles. Used with restraint. */
const bricolage = Bricolage_Grotesque({
  variable: '--font-bricolage',
  subsets: ['latin'],
  weight: ['700', '800'],
})

/** Body and UI chrome. */
const familjen = Familjen_Grotesk({
  variable: '--font-familjen',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
})

/** Every score, total, target and tally — tabular figures give them authority. */
const splineMono = Spline_Sans_Mono({
  variable: '--font-spline-mono',
  subsets: ['latin'],
  weight: ['400', '500', '700'],
})

export const metadata: Metadata = {
  title: 'Score Keeper',
  description: 'Keep score for cards and domino matches between two teams.',
  manifest: '/manifest.json',
  appleWebApp: {
    // iOS ignores the manifest for "Add to Home Screen" and needs its own
    // meta tags plus an opaque (non-transparent) touch icon.
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Score Keeper',
  },
  icons: {
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  // The page background, so mobile browser chrome matches the page instead of
  // flashing white. Both themes are declared so the OS picks the right one.
  // Hex duplicates of --bg from globals.css, since <meta theme-color> needs a
  // static value and can't reference a CSS custom property.
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#10141a' },
    { media: '(prefers-color-scheme: light)', color: '#faf6ee' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      // ThemeScript sets data-theme before paint, so the server-rendered markup
      // deliberately differs from the first client HTML here.
      suppressHydrationWarning
      className={`${bricolage.variable} ${familjen.variable} ${splineMono.variable} h-full antialiased`}
    >
      <head>
        <ThemeScript />
      </head>
      <body className="flex min-h-full flex-col">
        <QueryProvider>
          <AuthGate>{children}</AuthGate>
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  )
}
