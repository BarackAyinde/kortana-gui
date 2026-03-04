import { create } from 'zustand'

const SIDEBAR_WIDTH_KEY = 'kortana.sidebarWidth'
export const DEFAULT_SIDEBAR_WIDTH = 360
export const MIN_SIDEBAR_WIDTH = 220
export const MAX_SIDEBAR_WIDTH = 640

function loadSidebarWidth(): number {
  try {
    const v = localStorage.getItem(SIDEBAR_WIDTH_KEY)
    if (!v) return DEFAULT_SIDEBAR_WIDTH
    const n = parseInt(v, 10)
    return Number.isFinite(n)
      ? Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, n))
      : DEFAULT_SIDEBAR_WIDTH
  } catch {
    return DEFAULT_SIDEBAR_WIDTH
  }
}

interface UIState {
  sidebarOpen: boolean
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  sidebarWidth: number
  setSidebarWidth: (w: number) => void
  paletteOpen: boolean
  togglePalette: () => void
  setPaletteOpen: (open: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  sidebarWidth: loadSidebarWidth(),
  setSidebarWidth: (w) => {
    const clamped = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, w))
    try { localStorage.setItem(SIDEBAR_WIDTH_KEY, String(clamped)) } catch { /* ignore */ }
    set({ sidebarWidth: clamped })
  },

  paletteOpen: false,
  togglePalette: () => set((state) => ({ paletteOpen: !state.paletteOpen })),
  setPaletteOpen: (open) => set({ paletteOpen: open }),
}))
