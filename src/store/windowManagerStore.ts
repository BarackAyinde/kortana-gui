import { create } from 'zustand'
import type { PanelInstance, PanelType, CanvasMode, LayoutPreset, LayoutDirective } from '../types'
import { PANEL_REGISTRY } from '../panels/PANEL_REGISTRY'
import { LAYOUT_PRESETS } from '../layouts/LAYOUT_PRESETS'
import { useUIStore } from './uiStore'

const BASE_X = 80
const BASE_Y = 80
const CASCADE_OFFSET = 30
const BASE_Z = 10
const CANVAS_KEY = 'kortana.canvas'

function generateId(type: PanelType): string {
  return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
}

function maxZIndex(panels: PanelInstance[]): number {
  return panels.reduce((max, p) => Math.max(max, p.zIndex), BASE_Z)
}

interface PersistedCanvas {
  panels: PanelInstance[]
  canvasMode: CanvasMode
  presetId: string | null
  currentLayout: LayoutDirective | null
}

interface InitialState {
  panels: PanelInstance[]
  canvasMode: CanvasMode
  activePreset: LayoutPreset | null
  currentLayout: LayoutDirective | null
}

function loadCanvasState(): InitialState {
  try {
    const raw = localStorage.getItem(CANVAS_KEY)
    if (!raw) return { panels: [], canvasMode: 'free', activePreset: null, currentLayout: null }
    const data = JSON.parse(raw) as PersistedCanvas
    const activePreset = data.presetId
      ? (LAYOUT_PRESETS.find((p) => p.id === data.presetId) ?? null)
      : null
    return {
      panels: Array.isArray(data.panels) ? data.panels : [],
      canvasMode: data.canvasMode === 'dashboard' ? 'dashboard' : 'free',
      activePreset,
      currentLayout: data.currentLayout ?? null,
    }
  } catch {
    return { panels: [], canvasMode: 'free', activePreset: null, currentLayout: null }
  }
}

export interface WindowManagerState {
  panels: PanelInstance[]
  canvasMode: CanvasMode
  activePreset: LayoutPreset | null
  currentLayout: LayoutDirective | null
  lastFreePositions: Record<string, { x: number; y: number; w: number; h: number }>

  spawnPanel: (
    type: PanelType,
    props?: Record<string, unknown>,
    position?: { x: number; y: number },
  ) => void
  closePanel: (id: string) => void
  focusPanel: (id: string) => void
  movePanel: (id: string, x: number, y: number) => void
  resizePanel: (id: string, w: number, h: number) => void
  minimizePanel: (id: string) => void
  toggleCanvasMode: () => void
  setActivePreset: (preset: LayoutPreset | null) => void
  applyLayoutDirective: (directive: LayoutDirective) => void
}

const initial = loadCanvasState()

export const useWindowManagerStore = create<WindowManagerState>((set, get) => ({
  panels: initial.panels,
  canvasMode: initial.canvasMode,
  activePreset: initial.activePreset,
  currentLayout: initial.currentLayout,
  lastFreePositions: {},

  spawnPanel: (type, props = {}, position) => {
    const { panels } = get()
    const def = PANEL_REGISTRY[type]
    const count = panels.length
    const x = position?.x ?? BASE_X + (count % 8) * CASCADE_OFFSET
    const y = position?.y ?? BASE_Y + (count % 8) * CASCADE_OFFSET
    const zIndex = maxZIndex(panels) + 1

    const instance: PanelInstance = {
      id: generateId(type),
      type,
      x,
      y,
      width: def.defaultSize.w,
      height: def.defaultSize.h,
      zIndex,
      minimized: false,
      props,
    }

    set((state) => ({ panels: [...state.panels, instance] }))

    // Auto-collapse sidebar when chat panel is spawned as a canvas window
    if (type === 'chat') {
      useUIStore.getState().setSidebarOpen(false)
    }
  },

  closePanel: (id) => {
    set((state) => {
      const closing = state.panels.find((p) => p.id === id)
      const remaining = state.panels.filter((p) => p.id !== id)

      // Re-expand sidebar if the last chat panel is closed
      if (closing?.type === 'chat') {
        const hasOtherChat = remaining.some((p) => p.type === 'chat')
        if (!hasOtherChat) {
          useUIStore.getState().setSidebarOpen(true)
        }
      }

      return { panels: remaining }
    })
  },

  focusPanel: (id) =>
    set((state) => {
      const next = maxZIndex(state.panels) + 1
      return {
        panels: state.panels.map((p) =>
          p.id === id ? { ...p, zIndex: next } : p,
        ),
      }
    }),

  movePanel: (id, x, y) =>
    set((state) => ({
      panels: state.panels.map((p) => (p.id === id ? { ...p, x, y } : p)),
    })),

  resizePanel: (id, w, h) =>
    set((state) => ({
      panels: state.panels.map((p) =>
        p.id === id ? { ...p, width: w, height: h } : p,
      ),
    })),

  minimizePanel: (id) =>
    set((state) => ({
      panels: state.panels.map((p) =>
        p.id === id ? { ...p, minimized: !p.minimized } : p,
      ),
    })),

  toggleCanvasMode: () =>
    set((state) => {
      if (state.canvasMode === 'free') {
        // Save current free positions before entering dashboard
        const positions: WindowManagerState['lastFreePositions'] = {}
        for (const p of state.panels) {
          positions[p.type] = { x: p.x, y: p.y, w: p.width, h: p.height }
        }
        return { canvasMode: 'dashboard', activePreset: LAYOUT_PRESETS[0], lastFreePositions: positions }
      }
      return { canvasMode: 'free', activePreset: null }
    }),

  setActivePreset: (preset) => set({ activePreset: preset }),

  applyLayoutDirective: (directive) =>
    set((state) => ({
      currentLayout: directive,
      activePreset: null,
      // Auto-switch to dashboard so the user sees the layout immediately
      canvasMode: state.canvasMode === 'free' ? 'dashboard' : state.canvasMode,
    })),
}))

// Persist canvas state to localStorage — debounced 500ms
let persistTimer: ReturnType<typeof setTimeout> | null = null
useWindowManagerStore.subscribe((state) => {
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    try {
      const payload: PersistedCanvas = {
        panels: state.panels,
        canvasMode: state.canvasMode,
        presetId: state.activePreset?.id ?? null,
        currentLayout: state.currentLayout,
      }
      localStorage.setItem(CANVAS_KEY, JSON.stringify(payload))
    } catch { /* storage full */ }
  }, 500)
})
