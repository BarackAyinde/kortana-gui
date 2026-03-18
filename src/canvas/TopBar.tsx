import { useEffect, useRef, useState } from 'react'
import { useUIStore } from '../store/uiStore'
import { useWindowManagerStore } from '../store/windowManagerStore'
import { useConnectionStore } from '../store/connectionStore'
import { useConnection } from '../hooks/useConnection'
import { useClock } from '../hooks/useClock'
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
  const now = useClock()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useConnection()

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [dropdownOpen])

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
      setActivePreset(null)
    } else {
      setActivePreset(LAYOUT_PRESETS.find((p) => p.id === prev.id)!)
    }
  }

  const goForward = () => {
    if (navIdx >= navItems.length - 1) return
    const next = navItems[navIdx + 1]!
    setActivePreset(LAYOUT_PRESETS.find((p) => p.id === next.id)!)
  }

  const jumpTo = (id: string) => {
    if (id === '__kortana__') {
      setActivePreset(null)
    } else {
      setActivePreset(LAYOUT_PRESETS.find((p) => p.id === id)!)
    }
    setDropdownOpen(false)
  }

  const showNav = canvasMode === 'dashboard' && navItems.length > 1
  const currentLabel = navItems[navIdx]?.label ?? ''

  return (
    <header className="top-bar">
      <div className="top-bar__left">
        <span className="top-bar__wordmark">KORTANA</span>
        <Badge
          label={canvasMode === 'free' ? 'CANVAS' : 'DASHBOARD'}
          variant={canvasMode === 'dashboard' ? 'active' : 'dim'}
          onClick={toggleCanvasMode}
          title="Toggle dashboard / free mode (⌘⌥K)"
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

            <div ref={dropdownRef} className="layout-picker">
              <button
                key={navItems[navIdx]?.id}
                className="top-bar__layout-name top-bar__layout-name--btn"
                onClick={() => setDropdownOpen((o) => !o)}
                title="Switch dashboard"
              >
                {currentLabel}
                <span className="layout-picker__caret">{dropdownOpen ? '▴' : '▾'}</span>
              </button>

              {dropdownOpen && (
                <div className="layout-picker__dropdown">
                  {navItems.map((item, i) => (
                    <button
                      key={item.id}
                      className={`layout-picker__option${i === navIdx ? ' layout-picker__option--active' : ''}`}
                      onClick={() => jumpTo(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

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
        <span className="top-bar__timestamp">{formatTime(now)}</span>
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
