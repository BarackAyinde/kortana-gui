import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useXTerm } from 'react-xtermjs'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { GraphShell } from './GraphShell'
import { useStreamMode } from './streamMode'
import type { ShellMode } from './types'

const D = '\x1b[2m'
const O = '\x1b[0m'
const R = '\x1b[31m'

const XTERM_THEME = {
  background:    '#0d0d0d',
  foreground:    '#e0e0e0',
  cursor:        '#00ff88',
  cursorAccent:  '#0d0d0d',
  black:         '#000000',
  red:           '#ff4444',
  green:         '#00ff88',
  yellow:        '#ffaa00',
  blue:          '#00aaff',
  magenta:       '#aa00ff',
  cyan:          '#00ddcc',
  white:         '#e0e0e0',
  brightBlack:   '#555555',
  brightGreen:   '#00ff88',
}

export default function TerminalPanel() {
  const [mode, setMode] = useState<ShellMode>('stream')

  // ─── Stable refs (no stale closures in onData) ──────────────────────────────
  const modeRef = useRef<ShellMode>('stream')
  const instanceRef = useRef<ReturnType<typeof useXTerm>['instance']>(null)
  const shellRef = useRef(new GraphShell())
  const inputLineRef = useRef('')
  const histIdxRef = useRef(-1)

  // Keep modeRef in sync
  useEffect(() => { modeRef.current = mode }, [mode])

  // ─── xterm addons ────────────────────────────────────────────────────────────
  const fitAddon = useMemo(() => new FitAddon(), [])
  const webLinksAddon = useMemo(() => new WebLinksAddon(), [])

  // ─── Input handler — all refs, never stale ──────────────────────────────────
  const handleData = useCallback((data: string) => {
    if (modeRef.current !== 'shell') return
    const shell = shellRef.current
    const instance = instanceRef.current
    if (!instance) return

    // ── Confirmation mode ────────────────────────────────────────────────────
    if (shell.pendingConfirm !== null) {
      if (data === '\r') {
        const confirm = shell.pendingConfirm
        shell.pendingConfirm = null
        const input = inputLineRef.current
        inputLineRef.current = ''
        void confirm(input)
          .then(() => { instance.write(shell.getPrompt()) })
          .catch((err: unknown) => {
            instance.write(`\r\n${R}Error: ${err instanceof Error ? err.message : String(err)}${O}\r\n`)
            instance.write(shell.getPrompt())
          })
      } else if (data === '\x7f') {
        if (inputLineRef.current.length > 0) {
          inputLineRef.current = inputLineRef.current.slice(0, -1)
          instance.write('\b \b')
        }
      } else if (data.length === 1 && data >= ' ') {
        instance.write(data)
        inputLineRef.current += data
      }
      return
    }

    // ── Normal shell input ───────────────────────────────────────────────────
    if (data === '\r') {
      const cmd = inputLineRef.current
      inputLineRef.current = ''
      histIdxRef.current = -1
      instance.write('\r\n')
      if (cmd.trim() === 'clear') {
        instance.clear()
        instance.write(shell.getPrompt())
        return
      }
      void shell.execute(cmd, (s) => instance.write(s))
        .then(() => { instance.write(shell.getPrompt()) })
        .catch((err: unknown) => {
          instance.write(`${R}Error: ${err instanceof Error ? err.message : String(err)}${O}\r\n`)
          instance.write(shell.getPrompt())
        })
      return
    }

    if (data === '\x7f') {
      // Backspace
      if (inputLineRef.current.length > 0) {
        inputLineRef.current = inputLineRef.current.slice(0, -1)
        instance.write('\b \b')
      }
      return
    }

    if (data === '\x03') {
      // Ctrl+C
      inputLineRef.current = ''
      histIdxRef.current = -1
      shell.pendingConfirm = null
      instance.write('^C\r\n')
      instance.write(shell.getPrompt())
      return
    }

    if (data === '\t') {
      // Tab autocomplete
      const partial = inputLineRef.current.split(/\s+/).pop() ?? ''
      void shell.getAutocompleteOptions(partial).then((options) => {
        const inst = instanceRef.current
        if (!inst) return
        if (options.length === 1) {
          const completion = options[0]!.slice(partial.length)
          inputLineRef.current += completion
          inst.write(completion)
        } else if (options.length > 1) {
          inst.write('\r\n')
          for (const opt of options.slice(0, 10)) inst.write(`${D}${opt}${O}  `)
          inst.write('\r\n')
          inst.write(shell.getPrompt())
          inst.write(inputLineRef.current)
        }
      })
      return
    }

    if (data === '\x1b[A') {
      // Arrow up — history
      const history = shell.getHistory()
      const nextIdx = Math.min(histIdxRef.current + 1, history.length - 1)
      if (history[nextIdx] !== undefined) {
        const clear = '\r' + shell.getPrompt() + ' '.repeat(inputLineRef.current.length) + '\r' + shell.getPrompt()
        instance.write(clear)
        inputLineRef.current = history[nextIdx]!
        histIdxRef.current = nextIdx
        instance.write(inputLineRef.current)
      }
      return
    }

    if (data === '\x1b[B') {
      // Arrow down — history
      const history = shell.getHistory()
      const clear = '\r' + shell.getPrompt() + ' '.repeat(inputLineRef.current.length) + '\r' + shell.getPrompt()
      if (histIdxRef.current > 0) {
        const nextIdx = histIdxRef.current - 1
        instance.write(clear)
        inputLineRef.current = history[nextIdx]!
        histIdxRef.current = nextIdx
        instance.write(inputLineRef.current)
      } else if (histIdxRef.current === 0) {
        instance.write(clear)
        inputLineRef.current = ''
        histIdxRef.current = -1
      }
      return
    }

    // Printable character
    if (data.length === 1 && data >= ' ') {
      instance.write(data)
      inputLineRef.current += data
    }
  }, []) // no deps — all refs

  // ─── useXTerm ────────────────────────────────────────────────────────────────
  const { ref: xtermRef, instance } = useXTerm({
    options: {
      theme: XTERM_THEME,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: 12,
      cursorBlink: true,
      scrollback: 2000,
      convertEol: false,
    },
    addons: [fitAddon, webLinksAddon],
    listeners: { onData: handleData },
  })

  // Keep instanceRef in sync and fit after attach
  useEffect(() => {
    instanceRef.current = instance
    if (instance) fitAddon.fit()
  }, [instance, fitAddon])

  // ResizeObserver drives fitAddon
  useEffect(() => {
    const el = xtermRef.current
    if (!el) return
    const ro = new ResizeObserver(() => fitAddon.fit())
    ro.observe(el)
    return () => ro.disconnect()
  }, [xtermRef, fitAddon])

  // ─── STREAM mode ─────────────────────────────────────────────────────────────
  useStreamMode(instance, mode === 'stream')

  // ─── SHELL mode — write prompt on enter ─────────────────────────────────────
  useEffect(() => {
    if (mode !== 'shell' || !instance) return
    instance.clear()
    instance.write(`${D}kortana graph shell — type ${O}help${D} for commands, ${O}clear${D} to clear${O}\r\n`)
    instance.write(shellRef.current.getPrompt())
    inputLineRef.current = ''
    histIdxRef.current = -1
    shellRef.current.pendingConfirm = null
  }, [mode, instance])

  // ─── Initial welcome (STREAM mode) ───────────────────────────────────────────
  useEffect(() => {
    if (!instance) return
    instance.write(`${D}kortana terminal — STREAM mode, connecting…${O}\r\n`)
  }, [instance])

  return (
    <div className="terminal-panel-v2">
      <div className="terminal-panel-v2__header">
        <span className="terminal-panel-v2__title">TERMINAL</span>
        <div className="terminal-panel-v2__mode-tabs">
          <button
            className={`terminal-mode-tab-v2${mode === 'stream' ? ' terminal-mode-tab-v2--active' : ''}`}
            onClick={() => setMode('stream')}
          >
            STREAM
          </button>
          <button
            className={`terminal-mode-tab-v2${mode === 'shell' ? ' terminal-mode-tab-v2--active' : ''}`}
            onClick={() => setMode('shell')}
          >
            SHELL
          </button>
        </div>
      </div>
      <div className="terminal-panel-v2__canvas" ref={xtermRef} />
    </div>
  )
}
