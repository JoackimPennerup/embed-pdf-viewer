import '@/styles/tailwind.css'
import { getPageMap } from 'nextra/page-map'

export const metadata = {
  title:
    'Open-Source JavaScript PDF Viewer – Fast, Customizable & Framework-Agnostic | EmbedPDF',
  description:
    'EmbedPDF is a blazing-fast, MIT-licensed JavaScript PDF viewer that works with React, Vue, Svelte, and plain JS. Fully customizable, zero vendor lock-in, and perfect for modern web apps.',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  manifest: `/site.webmanifest`,
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let pageMap = await getPageMap()

  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
