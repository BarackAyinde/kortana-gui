import { useEffect, useRef, useState } from 'react'
import { useChatStore } from '../store/chatStore'
import { streamMessage, buildSystemPrompt } from '../lib/kortanaApi'
import { getContextSnapshot } from '../lib/contextCache'
import { parseLayoutDirective } from '../lib/parseLayoutDirective'
import { useWindowManagerStore } from '../store/windowManagerStore'
import type { ApiMessage } from '../lib/kortanaApi'

type ContextStatus = 'api' | 'file' | 'offline' | null

export default function MessageInput() {
  const [value, setValue] = useState('')
  const [nodeCount, setNodeCount] = useState<number | null>(null)
  const [contextStatus, setContextStatus] = useState<ContextStatus>(null)
  const { messages, addMessage, appendToLast, patchLast, setStreaming, isStreaming, setSystemPrompt } = useChatStore()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Fetch context on mount to populate the badge
  useEffect(() => {
    getContextSnapshot().then((snap) => {
      setNodeCount(snap.nodeCount)
      setContextStatus(snap.error ? 'offline' : snap.source)
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
    setContextStatus(snap.error ? 'offline' : snap.source)
    const systemPrompt = buildSystemPrompt(snap.markdown, snap.nodeCount)
    setSystemPrompt(systemPrompt)

    // 4. Build message history for the API
    const history: ApiMessage[] = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content },
    ]

    await streamMessage(history, systemPrompt, {
      onChunk: (chunk) => appendToLast(chunk),
      onDone: () => {
        setStreaming(false)
        // Parse layout directive from completed assistant message
        const lastMsg = useChatStore.getState().messages.at(-1)
        if (lastMsg?.role === 'assistant') {
          const { directive, cleanContent } = parseLayoutDirective(lastMsg.content)
          if (directive) {
            useWindowManagerStore.getState().applyLayoutDirective(directive)
          }
          if (cleanContent !== lastMsg.content) {
            patchLast(cleanContent)
          }
        }
      },
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

  const isLive = contextStatus === 'api'
  const isOffline = contextStatus === 'offline' || contextStatus === null

  return (
    <div className="msg-input-wrap">
      <div className="msg-input-meta">
        {isOffline ? (
          <span className="msg-input-meta__offline">◈ no context</span>
        ) : contextStatus === 'file' ? (
          <span className="msg-input-meta__file">◈ context file</span>
        ) : isLive ? (
          <span className="msg-input-meta__live">◈ context injected{nodeCount !== null ? ` · ${nodeCount} nodes` : ''}</span>
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
      <div className="msg-input__hint">↵ send&nbsp;&nbsp;&nbsp;⇧↵ newline</div>
    </div>
  )
}
