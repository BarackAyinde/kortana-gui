import { useEffect } from 'react'
import TopBar from './canvas/TopBar'
import CanvasZone from './canvas/CanvasZone'
import DashboardZone from './canvas/DashboardZone'
import ChatSidebar from './sidebar/ChatSidebar'
import CommandPalette from './ui/CommandPalette'
import ModeTransition from './ui/ModeTransition'
import RadarOverlay from './ui/RadarOverlay'
import { useUIStore } from './store/uiStore'
import { useWindowManagerStore } from './store/windowManagerStore'

export default function App() {
  const paletteOpen = useUIStore((s) => s.paletteOpen)
  const canvasMode = useWindowManagerStore((s) => s.canvasMode)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.code !== 'KeyK') return
      e.preventDefault()
      if (e.shiftKey) {
        useWindowManagerStore.getState().toggleCanvasMode()
      } else if (useWindowManagerStore.getState().canvasMode === 'free') {
        useUIStore.getState().togglePalette()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="app-shell">
      <TopBar />
      <div className="workspace">
        {canvasMode === 'free' ? <CanvasZone /> : <DashboardZone />}
        <ChatSidebar />
      </div>
      {paletteOpen && <CommandPalette />}
      <RadarOverlay />
      <ModeTransition />
    </div>
  )
}
