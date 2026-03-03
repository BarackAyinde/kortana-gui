import { create } from 'zustand'
import type { CanvasMode } from '../types'

interface UIState {
  sidebarOpen: boolean
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void

  // canvasMode lives here until WindowManagerStore is built in S-09
  canvasMode: CanvasMode
  toggleCanvasMode: () => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  canvasMode: 'free',
  toggleCanvasMode: () =>
    set((state) => ({
      canvasMode: state.canvasMode === 'free' ? 'dashboard' : 'free',
    })),
}))
