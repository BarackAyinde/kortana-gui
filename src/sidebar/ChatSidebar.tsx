import { useUIStore } from '../store/uiStore'
import MessageList from './MessageList'
import MessageInput from './MessageInput'

export default function ChatSidebar() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)

  return (
    <aside className="chat-sidebar" data-open={sidebarOpen}>
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
