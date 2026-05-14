import { create } from 'zustand'

interface UIStore {
  currentScreen: 'upload' | 'caption' | 'distribution' | 'monitor' | 'analytics'
  sidebarOpen: boolean
  notificationStack: Array<{ id: string; message: string; type: 'success' | 'error' | 'info' | 'warning' }>
  
  setScreen: (screen: UIStore['currentScreen']) => void
  toggleSidebar: () => void
  addNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void
  removeNotification: (id: string) => void
}

export const useUIStore = create<UIStore>((set) => ({
  currentScreen: 'upload',
  sidebarOpen: true,
  notificationStack: [],
  
  setScreen: (currentScreen) => set({ currentScreen }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  addNotification: (message, type) => set((state) => ({
    notificationStack: [
      ...state.notificationStack,
      { id: Date.now().toString(), message, type }
    ]
  })),
  removeNotification: (id) => set((state) => ({
    notificationStack: state.notificationStack.filter((n) => n.id !== id)
  }))
}))
