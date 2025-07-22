import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AURA - AI Presentation Coach',
  description: 'Améliorez vos présentations avec l\'intelligence artificielle',
  keywords: ['présentation', 'coaching', 'IA', 'intelligence artificielle', 'feedback'],
  authors: [{ name: 'AURA Team' }],
  viewport: 'width=device-width, initial-scale=1',
  themeColor: '#667eea',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className={`${inter.className} min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900`}>
        <div className="relative min-h-screen">
          {/* Background gradient overlay */}
          <div className="fixed inset-0 bg-gradient-to-br from-primary-900/20 via-accent-900/20 to-dark-900/20 pointer-events-none" />
          
          {/* Animated background elements */}
          <div className="fixed inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-500/10 rounded-full blur-3xl animate-pulse-slow" />
            <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent-500/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary-400/5 rounded-full blur-3xl animate-float" />
          </div>
          
          {/* Main content */}
          <div className="relative z-10">
            {children}
          </div>
        </div>
        
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#fff',
            },
          }}
        />
      </body>
    </html>
  )
}