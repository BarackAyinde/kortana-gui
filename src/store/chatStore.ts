import { create } from 'zustand'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export interface ChatState {
  messages: Message[]
  isStreaming: boolean
  systemPrompt: string
  addMessage: (msg: Pick<Message, 'role' | 'content'>) => void
  appendToLast: (chunk: string) => void
  patchLast: (content: string) => void
  setStreaming: (streaming: boolean) => void
  setSystemPrompt: (prompt: string) => void
  clearMessages: () => void
}

const SEED_MESSAGES: Message[] = [
  {
    id: 'seed-1',
    role: 'user',
    content: 'Phase 1 is complete. Context store is running at :4000.',
    timestamp: new Date(),
  },
  {
    id: 'seed-2',
    role: 'assistant',
    content:
      'Confirmed. 16 nodes seeded from CONTEXT.md — all open Question nodes resolved. Ready for Phase 2.',
    timestamp: new Date(),
  },
]

export const useChatStore = create<ChatState>((set) => ({
  messages: SEED_MESSAGES,
  isStreaming: false,
  systemPrompt: '',

  addMessage: (msg) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          ...msg,
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          timestamp: new Date(),
        },
      ],
    })),

  // Append a streaming chunk to the last assistant message
  appendToLast: (chunk) =>
    set((state) => {
      const messages = [...state.messages]
      const last = messages[messages.length - 1]
      if (!last || last.role !== 'assistant') return state
      messages[messages.length - 1] = { ...last, content: last.content + chunk }
      return { messages }
    }),

  // Replace the content of the last assistant message (used to strip directives)
  patchLast: (content) =>
    set((state) => {
      const messages = [...state.messages]
      const last = messages[messages.length - 1]
      if (!last || last.role !== 'assistant') return state
      messages[messages.length - 1] = { ...last, content }
      return { messages }
    }),

  setStreaming: (streaming) => set({ isStreaming: streaming }),

  setSystemPrompt: (prompt) => set({ systemPrompt: prompt }),

  clearMessages: () => set({ messages: [] }),
}))
