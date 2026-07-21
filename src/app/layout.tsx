import type { Metadata, Viewport } from 'next'
import { Bricolage_Grotesque, Familjen_Grotesk, Spline_Sans_Mono } from 'next/font/google'
import './globals.css'
import { ThemeScript } from '@/components/shell/ThemeScript'
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
}

export const viewport: Viewport = {
  // The felt background, so mobile browser chrome matches the page instead of
  // flashing white. Both themes are declared so the OS picks the right one.
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#141F18' },
    { media: '(prefers-color-scheme: light)', color: '#E9E2CF' },
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
          {children}
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  )
}
