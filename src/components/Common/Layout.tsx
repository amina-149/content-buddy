import React from 'react'
import { Navigation } from './Navigation'
import { useUIStore } from '@/stores/uiStore'

interface LayoutProps {
  children: React.ReactNode
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const sidebarOpen = useUIStore((state) => state.sidebarOpen)
  
  return (
    <div className="flex h-screen bg-gray-100">
      <Navigation />
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
