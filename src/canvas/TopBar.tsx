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
  const { canvasMode, activePreset, setActivePreset } = useWindowManagerStore()
  const status = useConnectionStore((s) => s.status)
  const [time, setTime] = useState(() => formatTime(new Date()))

  // Start polling the context store
  useConnection()

  // Tick the clock every second
  useEffect(() => {
    const interval = setInterval(() => setTime(formatTime(new Date())), 1000)
    return () => clearInterval(interval)
  }, [])

  const presetIdx = LAYOUT_PRESETS.findIndex((p) => p.id === activePreset?.id)

  return (
    <header className="top-bar">
      <div className="top-bar__left">
        <span className="top-bar__wordmark">KORTANA</span>
        <Badge
          label={canvasMode === 'free' ? 'CANVAS' : 'DASHBOARD'}
          variant={canvasMode === 'dashboard' ? 'active' : 'dim'}
        />
        {canvasMode === 'dashboard' && activePreset && (
          <>
            <button
              className="icon-btn"
              onClick={() => setActivePreset(LAYOUT_PRESETS[presetIdx - 1])}
              disabled={presetIdx <= 0}
              title="Previous layout"
            >
              ◂
            </button>
            <span key={activePreset.id} className="top-bar__layout-name">{activePreset.label}</span>
            <button
              className="icon-btn"
              onClick={() => setActivePreset(LAYOUT_PRESETS[presetIdx + 1])}
              disabled={presetIdx >= LAYOUT_PRESETS.length - 1}
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
          className="icon-btn"
          onClick={toggleSidebar}
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {sidebarOpen ? '›' : '‹'}
        </button>
      </div>
    </header>
  )
}
