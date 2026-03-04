import type { Message } from '../store/chatStore'

interface MessageBubbleProps {
  message: Message
  isStreaming?: boolean
  isLast?: boolean
}

export default function MessageBubble({ message, isStreaming, isLast }: MessageBubbleProps) {
  const time = message.timestamp.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const showCursor = isStreaming && isLast && message.role === 'assistant'

  if (message.role === 'user') {
    return (
      <div className="msg msg--user">
        <span className="msg__user-label">YOU</span>
        <div className="msg__bubble">{message.content}</div>
        <span className="msg__time">{time}</span>
      </div>
    )
  }

  return (
    <div className="msg msg--assistant">
      <div className="msg__header">
        <span className="msg__sender">KORTANA</span>
        <span className="msg__time">{time}</span>
      </div>
      <div className="msg__content">
        {message.content}
        {showCursor && <span className="msg__cursor">▋</span>}
      </div>
    </div>
  )
}
