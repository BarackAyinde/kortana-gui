import { useEffect, useState } from 'react'
import { useUIStore } from '../store/uiStore'
import { useWindowManagerStore } from '../store/windowManagerStore'
import { useConnectionStore } from '../store/connectionStore'
import { useConnection } from '../hooks/useConnection'
import { LAYOUT_PRESETS } from '../layouts/LAYOUT_PRESETS'
import StatusDot from '../ui/StatusDot'
import Badge from '../ui/Badge'

function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function TopBar() {
  const { sidebarOpen, toggleSidebar } = useUIStore()
  const { canvasMode, activePreset, currentLayout, setActivePreset, toggleCanvasMode } = useWindowManagerStore()
  const status = useConnectionStore((s) => s.status)
  const [time, setTime] = useState(() => formatTime(new Date()))

  useConnection()

  useEffect(() => {
    const interval = setInterval(() => setTime(formatTime(new Date())), 1000)
    return () => clearInterval(interval)
  }, [])

  // Build the combined nav: "KORTANA" entry (if AI layout exists) + all presets
  const hasKortanaView = currentLayout !== null
  const navItems = hasKortanaView
    ? [{ id: '__kortana__', label: 'KORTANA' }, ...LAYOUT_PRESETS]
    : [...LAYOUT_PRESETS]

  // Current position in navItems
  const navIdx = hasKortanaView && !activePreset
    ? 0
    : navItems.findIndex((item) => item.id === activePreset?.id)

  const goBack = () => {
    if (navIdx <= 0) return
    const prev = navItems[navIdx - 1]!
    if (prev.id === '__kortana__') {
      setActivePreset(null) // go back to AI layout
    } else {
      setActivePreset(LAYOUT_PRESETS.find((p) => p.id === prev.id)!)
    }
  }

  const goForward = () => {
    if (navIdx >= navItems.length - 1) return
    const next = navItems[navIdx + 1]!
    setActivePreset(LAYOUT_PRESETS.find((p) => p.id === next.id)!)
  }

  const showNav = canvasMode === 'dashboard' && navItems.length > 1

  return (
    <header className="top-bar">
      <div className="top-bar__left">
        <span className="top-bar__wordmark">KORTANA</span>
        <Badge
          label={canvasMode === 'free' ? 'CANVAS' : 'DASHBOARD'}
          variant={canvasMode === 'dashboard' ? 'active' : 'dim'}
          onClick={toggleCanvasMode}
          title="Toggle dashboard / free mode (⌘⇧K)"
        />
        {showNav && (
          <>
            <button
              className="icon-btn"
              onClick={goBack}
              disabled={navIdx <= 0}
              title="Previous layout"
            >
              ◂
            </button>
            <span key={navItems[navIdx]?.id} className="top-bar__layout-name">
              {navItems[navIdx]?.label ?? ''}
            </span>
            <button
              className="icon-btn"
              onClick={goForward}
              disabled={navIdx >= navItems.length - 1}
              title="Next layout"
            >
              ▸
            </button>
          </>
        )}
      </div>

      <div className="top-bar__right">
        <StatusDot status={status} />
        <span className="top-bar__timestamp">{time}</span>
        <button
          className="icon-btn top-bar__sidebar-toggle"
          onClick={toggleSidebar}
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {sidebarOpen ? '⊣' : '⊢'}
        </button>
      </div>
    </header>
  )
}
