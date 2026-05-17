import React from 'react'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import { Menu, LogOut, BarChart3, Monitor, Share2, Check, Download } from 'lucide-react'

export const Navigation: React.FC = () => {
  const currentScreen = useUIStore((state) => state.currentScreen)
  const setScreen = useUIStore((state) => state.setScreen)
  const logout = useAuthStore((state) => state.logout)
  const toggleSidebar = useUIStore((state) => state.toggleSidebar)
  const sidebarOpen = useUIStore((state) => state.sidebarOpen)
  const user = useAuthStore((state) => state.user)

  const menuItems = [
    { id: 'upload', label: 'Video Downloader', icon: Download },
    { id: 'caption', label: 'Review Captions', icon: Check },
    { id: 'distribution', label: 'Distribution', icon: Share2 },
    { id: 'monitor', label: 'Job Monitor', icon: Monitor },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 }
  ] as const

  return (
    <nav className={`relative shrink-0 bg-secondary text-white transition-all duration-300 flex flex-col ${sidebarOpen ? 'w-64' : 'w-16 md:w-20'}`}>
      <div className="p-4 flex items-center justify-between border-b border-white/10">
        {sidebarOpen && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-blue-700 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              </svg>
            </div>
            <h1 className="text-lg font-bold">OmniSolve AI</h1>
          </div>
        )}
        <button onClick={toggleSidebar} className="p-2 hover:bg-white/10 rounded-lg transition">
          <Menu size={20} />
        </button>
      </div>

      {sidebarOpen && user && (
        <div className="px-4 py-3 border-b border-white/10">
          <p className="text-sm font-medium truncate">{user.firstName || user.email}</p>
          <p className="text-xs text-gray-400 truncate">{user.email}</p>
        </div>
      )}

      <ul className="mt-3 flex-1 overflow-y-auto">
        {menuItems.map(({ id, label, icon: Icon }) => (
          <li key={id}>
            <button
              onClick={() => setScreen(id)}
              className={`w-full flex items-center gap-3 px-3 md:px-5 py-3 transition text-left ${
                currentScreen === id
                  ? 'bg-primary/20 border-l-4 border-accent text-white'
                  : 'hover:bg-white/5 text-gray-300 hover:text-white border-l-4 border-transparent'
              }`}
            >
              <Icon size={18} />
              {sidebarOpen && <span className="text-sm">{label}</span>}
            </button>
          </li>
        ))}
      </ul>

      <div className="p-4 border-t border-white/10">
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600/80 hover:bg-red-600 rounded-lg transition text-sm"
        >
          <LogOut size={18} />
          {sidebarOpen && <span>Logout</span>}
        </button>
      </div>
    </nav>
  )
}
