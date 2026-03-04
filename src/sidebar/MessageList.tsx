import { useEffect, useRef, useState } from 'react'
import { useChatStore } from '../store/chatStore'
import MessageBubble from './MessageBubble'

export default function MessageList() {
  const messages = useChatStore((s) => s.messages)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const systemPrompt = useChatStore((s) => s.systemPrompt)
  const [systemExpanded, setSystemExpanded] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  // Track whether user has scrolled up to read history
  const userScrolledUp = useRef(false)

  const handleScroll = () => {
    const el = listRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    userScrolledUp.current = !atBottom
  }

  useEffect(() => {
    if (userScrolledUp.current) return
    bottomRef.current?.scrollIntoView({ behavior: 'instant' as ScrollBehavior })
  }, [messages])

  return (
    <div ref={listRef} className="message-list" onScroll={handleScroll}>
      {/* Collapsible [SYSTEM] block */}
      <div className="chat-system">
        <button
          className="chat-system__toggle"
          onClick={() => setSystemExpanded((v) => !v)}
          aria-expanded={systemExpanded}
        >
          <span className="chat-system__arrow">{systemExpanded ? '▾' : '▸'}</span>
          [SYSTEM]
        </button>
        {systemExpanded && (
          <pre className="chat-system__body">
            {systemPrompt || '(system prompt will appear after first message)'}
          </pre>
        )}
      </div>

      {messages.map((msg, i) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          isStreaming={isStreaming}
          isLast={i === messages.length - 1}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
