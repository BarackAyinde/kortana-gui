import { useEffect } from 'react'
import { useUIStore } from '../store/uiStore'
import { useConnectionStore } from '../store/connectionStore'
import { useConnection } from '../hooks/useConnection'
import StatusDot from '../ui/StatusDot'
import Badge from '../ui/Badge'

// Session start time — captured once at module load, never changes
const SESSION_START = new Date().toLocaleTimeString('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
})

export default function TopBar() {
  const { sidebarOpen, toggleSidebar, canvasMode, toggleCanvasMode } = useUIStore()
  const status = useConnectionStore((s) => s.status)

  // Start polling the context store
  useConnection()

  // Cmd+Shift+D → toggle canvas mode
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'D') {
        e.preventDefault()
        toggleCanvasMode()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleCanvasMode])

  return (
    <header className="top-bar">
      <div className="top-bar__left">
        <span className="top-bar__wordmark">KORTANA</span>
        <Badge
          label={canvasMode === 'free' ? 'FREE' : 'DASHBOARD'}
          variant={canvasMode === 'dashboard' ? 'active' : 'dim'}
        />
        {canvasMode === 'dashboard' && (
          <span className="top-bar__layout-name">INTELLIGENCE VIEW</span>
        )}
      </div>

      <div className="top-bar__right">
        <StatusDot status={status} />
        <span className="top-bar__timestamp">{SESSION_START}</span>
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
