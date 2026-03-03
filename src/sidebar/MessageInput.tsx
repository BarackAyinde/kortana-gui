import { useEffect, useRef, useState } from 'react'
import { useChatStore } from '../store/chatStore'
import { streamMessage, buildSystemPrompt } from '../lib/kortanaApi'
import { getContextSnapshot } from '../lib/contextCache'
import type { ApiMessage } from '../lib/kortanaApi'

export default function MessageInput() {
  const [value, setValue] = useState('')
  const [nodeCount, setNodeCount] = useState<number | null>(null)
  const [contextOffline, setContextOffline] = useState(false)
  const { messages, addMessage, appendToLast, setStreaming, isStreaming } = useChatStore()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Fetch context on mount to populate the badge
  useEffect(() => {
    getContextSnapshot().then((snap) => {
      setNodeCount(snap.nodeCount)
      setContextOffline(snap.error !== null)
    })
  }, [])

  const canSend = value.trim().length > 0 && !isStreaming

  const send = async () => {
    const content = value.trim()
    if (!content || isStreaming) return

    // 1. Add user message, clear input
    addMessage({ role: 'user', content })
    setValue('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    // 2. Seed empty assistant message, start streaming
    addMessage({ role: 'assistant', content: '' })
    setStreaming(true)

    // 3. Fetch context (30s cache) and build system prompt
    const snap = await getContextSnapshot()
    setNodeCount(snap.nodeCount)
    setContextOffline(snap.error !== null)
    const systemPrompt = buildSystemPrompt(snap.markdown, snap.nodeCount)

    // 4. Build message history for the API
    const history: ApiMessage[] = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content },
    ]

    await streamMessage(history, systemPrompt, {
      onChunk: (chunk) => appendToLast(chunk),
      onDone: () => setStreaming(false),
      onError: (err) => {
        appendToLast(`\n\n[Error: ${err.message}]`)
        setStreaming(false)
      },
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  // Auto-resize textarea as content grows (max 5 lines)
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }

  return (
    <div className="msg-input-wrap">
      <div className="msg-input-meta">
        {contextOffline ? (
          <span className="msg-input-meta__offline">context offline</span>
        ) : nodeCount !== null ? (
          <span className="msg-input-meta__badge">context: {nodeCount} nodes</span>
        ) : null}
      </div>
      <div className="msg-input">
      <textarea
        ref={textareaRef}
        className="msg-input__textarea"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={isStreaming ? '' : 'Message Kortana…'}
        disabled={isStreaming}
        rows={1}
        aria-label="Message input"
      />
      {isStreaming ? (
        <div className="msg-input__typing">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </div>
      ) : (
        <button
          className="msg-input__send"
          onClick={send}
          disabled={!canSend}
          aria-label="Send message"
        >
          ↵
        </button>
      )}
      </div>
    </div>
  )
}
