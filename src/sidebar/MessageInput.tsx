import { useEffect, useRef, useState } from 'react'
import { useChatStore } from '../store/chatStore'
import { streamMessage, buildSystemPrompt } from '../lib/kortanaApi'
import { getContextSnapshot } from '../lib/contextCache'
import { parseLayoutDirective } from '../lib/parseLayoutDirective'
import { useWindowManagerStore } from '../store/windowManagerStore'
import { setPendingDiff } from '../panels/CodeEditorPanel'
import { postWorkflow } from '../lib/postWorkflow'
import { useSettingsStore } from '../store/settingsStore'
import { useVoiceStore } from '../store/voiceStore'
import { KORTANA_TOOLS } from '../lib/toolRegistry'
import VoiceInput from './VoiceInput'
import type { ApiMessage } from '../lib/kortanaApi'

type ContextStatus = 'api' | 'file' | 'offline' | null

// ─── Tools Dropdown ───────────────────────────────────────────────────────────

function ToolsDropdown({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [onClose])

  return (
    <div className="tools-dropdown" ref={ref}>
      <div className="tools-dropdown__header">KORTANA TOOLS</div>
      {KORTANA_TOOLS.map((tool) => (
        <div key={tool.id} className="tools-dropdown__item" data-status={tool.status}>
          <span className="tools-dropdown__icon">{tool.icon}</span>
          <div className="tools-dropdown__info">
            <span className="tools-dropdown__label">{tool.label}</span>
            <span className="tools-dropdown__desc">{tool.description}</span>
          </div>
          {tool.status === 'stub' && (
            <span className="tools-dropdown__stub">SOON</span>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── MessageInput ─────────────────────────────────────────────────────────────

export default function MessageInput() {
  const [value, setValue] = useState('')
  const [nodeCount, setNodeCount] = useState<number | null>(null)
  const [contextStatus, setContextStatus] = useState<ContextStatus>(null)
  const [toolsOpen, setToolsOpen] = useState(false)
  const { messages, addMessage, appendToLast, patchLast, setStreaming, isStreaming, setSystemPrompt } = useChatStore()
  const { selectedModel } = useSettingsStore()
  const { isVoiceActive, setSpeaking, chatterboxVoiceKey, selectedSpeakerId } = useVoiceStore()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Fetch context on mount to populate the badge
  useEffect(() => {
    getContextSnapshot().then((snap) => {
      setNodeCount(snap.nodeCount)
      setContextStatus(snap.error ? 'offline' : snap.source)
    })
  }, [])

  const canSend = value.trim().length > 0 && !isStreaming

  const send = async (overrideContent?: string) => {
    const content = (overrideContent ?? value).trim()
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
          const { directive, diffPayload, workflowPayload, cleanContent } = parseLayoutDirective(lastMsg.content)
          if (directive) {
            useWindowManagerStore.getState().applyLayoutDirective(directive)
          }
          if (diffPayload) {
            setPendingDiff(diffPayload)
          }
          if (workflowPayload) {
            postWorkflow(workflowPayload).then((workflowId) => {
              window.dispatchEvent(new CustomEvent('kortana:open-workflow', { detail: { workflowId } }))
            }).catch(() => {/* store offline */})
          }
          if (cleanContent !== lastMsg.content) {
            patchLast(cleanContent)
          }
          // TTS — speak the final clean content when voice mode is active
          if (isVoiceActive) {
            const textToSpeak = (cleanContent !== lastMsg.content ? cleanContent : lastMsg.content)
              .replace(/```[\s\S]*?```/g, '')   // strip code blocks
              .replace(/`[^`]*`/g, '')           // strip inline code
              .replace(/\[.*?\]\(.*?\)/g, '')    // strip markdown links
              .replace(/[*_#>~]/g, '')           // strip markdown syntax
              .trim()
            if (textToSpeak.length > 0) {
              setSpeaking(true)
              import('../lib/chatterboxApi').then(({ speakText }) => {
                return speakText({ text: textToSpeak.slice(0, 1000), voiceKey: chatterboxVoiceKey, speakerId: selectedSpeakerId })
              }).catch(() => { /* TTS failures are non-fatal */ }).finally(() => setSpeaking(false))
            }
          }
        }
      },
      onError: (err) => {
        appendToLast(`\n\n[Error: ${err.message}]`)
        setStreaming(false)
      },
    }, selectedModel)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
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

      {isVoiceActive ? (
        <VoiceInput onTranscript={(text) => void send(text)} disabled={isStreaming} />
      ) : (
        <div className="msg-input">
          <div className="msg-input__tools-wrap">
            <button
              className="msg-input__tools-btn"
              onClick={() => setToolsOpen((v) => !v)}
              aria-label="Show available tools"
              title="Available tools"
              data-active={toolsOpen}
            >
              +
            </button>
            {toolsOpen && <ToolsDropdown onClose={() => setToolsOpen(false)} />}
          </div>
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
              onClick={() => void send()}
              disabled={!canSend}
              aria-label="Send message"
            >
              ↵
            </button>
          )}
        </div>
      )}
    </div>
  )
}
