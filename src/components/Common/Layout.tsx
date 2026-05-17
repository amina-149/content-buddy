import React from 'react'
import { Navigation } from './Navigation'

interface LayoutProps {
  children: React.ReactNode
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <Navigation />
      <main className="flex-1 min-w-0 overflow-auto">
        <div className="p-3 md:p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
