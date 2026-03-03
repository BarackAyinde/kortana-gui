import { useRef, useState } from 'react'
import { useChatStore } from '../store/chatStore'

export default function MessageInput() {
  const [value, setValue] = useState('')
  const { addMessage, isStreaming } = useChatStore()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const canSend = value.trim().length > 0 && !isStreaming

  const send = () => {
    const content = value.trim()
    if (!content || isStreaming) return
    addMessage({ role: 'user', content })
    setValue('')
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
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
  )
}
