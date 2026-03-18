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
      e.stopImmediatePropagation()
      if (e.altKey) {
        useWindowManagerStore.getState().toggleCanvasMode()
      } else {
        useUIStore.getState().togglePalette()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
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
