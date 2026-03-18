// streamMode.tsx — WebSocket log stream renderer (preserves existing Log Stream behaviour)
import { useEffect } from 'react'
import type { Terminal } from '@xterm/xterm'

const WS_URL = 'ws://localhost:4000'

// ANSI colours matching spec
const G = '\x1b[32m'  // node:created
const Y = '\x1b[33m'  // node:updated
const R = '\x1b[31m'  // node:deleted
const C = '\x1b[36m'  // node:content_updated
const B = '\x1b[34m'  // edge:created
const W = '\x1b[37m'  // system / other
const D = '\x1b[2m'
const O = '\x1b[0m'

function eventColor(eventName: string): string {
  switch (eventName) {
    case 'node:created':          return G
    case 'node:updated':          return Y
    case 'node:deleted':          return R
    case 'node:content_updated':  return C
    case 'edge:created':          return B
    default:                      return W
  }
}

function fmtTime(): string {
  return new Date().toTimeString().slice(0, 8)
}

export function useStreamMode(instance: Terminal | null, active: boolean): void {
  useEffect(() => {
    if (!active || !instance) return

    instance.write(`${D}[${fmtTime()}] connecting → ${WS_URL}…${O}\r\n`)

    const ws = new WebSocket(WS_URL)

    ws.onopen = () => {
      instance.write(`${D}[${fmtTime()}]${O} ${W}connected${O}\r\n`)
    }

    ws.onmessage = (e: MessageEvent<string>) => {
      try {
        const parsed = JSON.parse(e.data) as { event: string; data: Record<string, unknown> }
        const { event: eventName, data } = parsed
        if (eventName === 'connected') return

        const color = eventColor(eventName)
        const label =
          (data?.label as string | undefined) ??
          (data?.nodeId as string | undefined) ??
          (data?.id as string | undefined) ??
          ''

        instance.write(
          `${D}[${fmtTime()}]${O} ${color}${eventName}${O}${label ? `  ${D}${label}${O}` : ''}\r\n`,
        )
      } catch {
        instance.write(`${D}[${fmtTime()}]${O} ${e.data}\r\n`)
      }
    }

    ws.onerror = () => {
      instance.write(`${R}[ws] error${O}\r\n`)
    }

    ws.onclose = () => {
      instance.write(`${D}[${fmtTime()}] disconnected${O}\r\n`)
    }

    return () => ws.close()
  }, [active, instance])
}
