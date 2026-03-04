import { useCallback, useRef } from 'react'
import { useUIStore, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH } from '../store/uiStore'
import MessageList from './MessageList'
import MessageInput from './MessageInput'

export default function ChatSidebar() {
  const { sidebarOpen, sidebarWidth, setSidebarWidth } = useUIStore()
  const sidebarRef = useRef<HTMLElement>(null)

  const onHandleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const el = sidebarRef.current
    if (!el) return

    const startX = e.clientX
    const startWidth = sidebarWidth

    // Kill the open/close transition during drag so every pixel is instant
    el.dataset.resizing = 'true'

    const onMove = (ev: MouseEvent) => {
      const w = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, startWidth + startX - ev.clientX))
      el.style.width = `${w}px`
    }

    const onUp = () => {
      delete el.dataset.resizing
      // Commit final width to store (single state update on release)
      const final = parseInt(el.style.width) || startWidth
      setSidebarWidth(final)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [sidebarWidth, setSidebarWidth])

  return (
    <aside
      ref={sidebarRef}
      className="chat-sidebar"
      data-open={sidebarOpen}
      style={sidebarOpen ? { width: sidebarWidth } : undefined}
    >
      {sidebarOpen && (
        <div className="chat-sidebar__resize-handle" onMouseDown={onHandleMouseDown} />
      )}
      <div className="chat-sidebar__inner">
        <div className="chat-sidebar__header">
          <span className="chat-sidebar__title">CHAT</span>
        </div>
        <MessageList />
        <MessageInput />
      </div>
    </aside>
  )
}
