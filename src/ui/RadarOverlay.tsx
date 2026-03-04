import { useChatStore } from '../store/chatStore'

export default function RadarOverlay() {
  const isStreaming = useChatStore((s) => s.isStreaming)
  if (!isStreaming) return null

  return (
    <div className="radar-overlay" aria-hidden>
      <div className="radar-core">
        <span className="radar-label">KORTANA</span>
        <div className="radar-ring radar-ring--1" />
        <div className="radar-ring radar-ring--2" />
        <div className="radar-ring radar-ring--3" />
      </div>
    </div>
  )
}
