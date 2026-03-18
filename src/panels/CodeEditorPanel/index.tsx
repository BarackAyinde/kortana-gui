import { useCallback, useEffect, useRef, useState } from 'react'
import Editor, { DiffEditor } from '@monaco-editor/react'
import type * as Monaco from 'monaco-editor'
import { defineKortanaTheme, THEME_NAME } from './kortanaTheme'
import EditorTabs from './EditorTabs'
import DiffHeader from './DiffHeader'
import type { EditorMode, EditorTab, DiffPayload } from './types'

// ─── Language detection from extension ───────────────────────────────────────

function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript',
    js: 'javascript', jsx: 'javascript',
    py: 'python',
    json: 'json',
    md: 'markdown',
    css: 'css',
    html: 'html',
    sh: 'shell',
    yml: 'yaml', yaml: 'yaml',
    sql: 'sql',
    rs: 'rust',
    go: 'go',
  }
  return map[ext] ?? 'plaintext'
}

// ─── Tab management ───────────────────────────────────────────────────────────

function makeTab(filename: string, content = ''): EditorTab {
  return {
    id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    filename,
    content,
    language: detectLanguage(filename),
    isDirty: false,
  }
}

// ─── Pending diff store (module-level, populated by directive parser) ─────────

let pendingDiff: DiffPayload | null = null

export function setPendingDiff(payload: DiffPayload): void {
  pendingDiff = payload
  // Dispatch a custom event so any mounted CodeEditorPanel can react immediately
  window.dispatchEvent(new CustomEvent('kortana:diff', { detail: payload }))
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CodeEditorPanel() {
  const [tabs, setTabs] = useState<EditorTab[]>(() => [makeTab('untitled.ts')])
  const [activeId, setActiveId] = useState<string>(() => '')
  const [mode, setMode] = useState<EditorMode>('edit')
  const [diffPayload, setDiffPayload] = useState<DiffPayload | null>(pendingDiff)
  const [sideBySide, setSideBySide] = useState(true)

  // Initialise activeId after first render
  useEffect(() => {
    setActiveId((prev) => prev || (tabs[0]?.id ?? ''))
  }, [tabs])

  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // ─── ResizeObserver: re-layout editor on container resize ─────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      editorRef.current?.layout()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ─── Monaco theme registration ────────────────────────────────────────────
  const handleBeforeMount = useCallback((monaco: typeof Monaco) => {
    defineKortanaTheme(monaco)
  }, [])

  const handleMount = useCallback((editor: Monaco.editor.IStandaloneCodeEditor, monaco: typeof Monaco) => {
    editorRef.current = editor

    // Ctrl+S saves active tab content to context store if the tab has a nodeId
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      const activeTab = tabs.find((t) => t.id === activeId)
      if (!activeTab) return
      const nodeId = activeTab.filename.replace(/\.[^.]+$/, '') // strip extension as node id
      const content = editor.getValue()
      // Persist to context store
      fetch(`http://localhost:4000/nodes/${nodeId}/content`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      }).catch(() => {/* non-fatal */})
    })
  }, [tabs, activeId])

  // ─── KORTANA_DELTA directive listener ─────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const payload = (e as CustomEvent<DiffPayload>).detail
      setDiffPayload(payload)
      setMode('diff')
    }
    window.addEventListener('kortana:diff', handler)
    return () => window.removeEventListener('kortana:diff', handler)
  }, [])

  // ─── kortana:open-file listener (from Graph Shell touch command) ──────────
  useEffect(() => {
    const handler = (e: Event) => {
      const { nodeId, label } = (e as CustomEvent<{ nodeId: string; label: string }>).detail
      const filename = `${nodeId}.ts`
      const newTab = makeTab(filename, `// ${label}\n`)
      setTabs((prev) => [...prev.slice(0, 8), newTab]) // max 8 tabs
      setActiveId(newTab.id)
      setMode('edit')
    }
    window.addEventListener('kortana:open-file', handler)
    return () => window.removeEventListener('kortana:open-file', handler)
  }, [])

  // ─── Tab operations ───────────────────────────────────────────────────────
  const handleSelectTab = (id: string) => {
    setActiveId(id)
    setMode('edit')
  }

  const handleCloseTab = (id: string) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id)
      if (next.length === 0) {
        const fallback = makeTab('untitled.ts')
        setActiveId(fallback.id)
        return [fallback]
      }
      if (id === activeId) {
        setActiveId(next[next.length - 1]!.id)
      }
      return next
    })
  }

  const handleAddTab = (filename: string) => {
    const newTab = makeTab(filename)
    setTabs((prev) => [...prev.slice(0, 7), newTab]) // keep max 8
    setActiveId(newTab.id)
    setMode('edit')
  }

  // ─── Editor content change ────────────────────────────────────────────────
  const handleContentChange = (value: string | undefined) => {
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeId ? { ...t, content: value ?? '', isDirty: true } : t,
      ),
    )
  }

  // ─── Accept / Reject diff ─────────────────────────────────────────────────
  const handleAccept = () => {
    if (!diffPayload) return
    const proposed = diffPayload.proposed
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeId ? { ...t, content: proposed, isDirty: true } : t,
      ),
    )
    setMode('edit')
    setDiffPayload(null)
  }

  const handleReject = () => {
    if (!diffPayload) return
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeId ? { ...t, content: diffPayload.original, isDirty: false } : t,
      ),
    )
    setMode('edit')
    setDiffPayload(null)
  }

  const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0]

  const editorOptions: Monaco.editor.IStandaloneEditorConstructionOptions = {
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    fontSize: 13,
    lineNumbers: 'on' as const,
    minimap: { enabled: true, side: 'right' as const },
    wordWrap: 'off' as const,
    scrollBeyondLastLine: false,
    automaticLayout: false, // we drive layout manually via ResizeObserver
    tabSize: 2,
    renderLineHighlight: 'gutter' as const,
  }

  return (
    <div className="code-editor-panel" ref={containerRef}>
      {/* Header: mode toggle + mode badge */}
      <div className="code-editor-panel__header">
        <span className="code-editor-panel__title">
          CODE <span className="code-editor-panel__mode-badge">{mode.toUpperCase()}</span>
        </span>
        <div className="code-editor-panel__controls">
          {mode === 'diff' && (
            <button
              className="code-editor-panel__inline-btn"
              onClick={() => setSideBySide((v) => !v)}
              title="Toggle inline/side-by-side diff"
            >
              {sideBySide ? '⊟ inline' : '⊞ split'}
            </button>
          )}
          <div className="code-editor-panel__mode-tabs">
            <button
              className={`code-editor-mode-tab${mode === 'edit' ? ' code-editor-mode-tab--active' : ''}`}
              onClick={() => setMode('edit')}
            >
              EDIT
            </button>
            <button
              className={`code-editor-mode-tab${mode === 'diff' ? ' code-editor-mode-tab--active' : ''}`}
              onClick={() => setMode('diff')}
            >
              DIFF
            </button>
          </div>
        </div>
      </div>

      {/* File tab bar */}
      <EditorTabs
        tabs={tabs}
        activeId={activeId}
        onSelect={handleSelectTab}
        onClose={handleCloseTab}
        onAdd={handleAddTab}
      />

      {/* Diff accept/reject bar — only shown in DIFF mode with a payload */}
      {mode === 'diff' && diffPayload && (
        <DiffHeader
          filename={diffPayload.file}
          onAccept={handleAccept}
          onReject={handleReject}
        />
      )}

      {/* Editor canvas */}
      <div className="code-editor-panel__canvas">
        {mode === 'edit' ? (
          <Editor
            language={activeTab?.language ?? 'typescript'}
            value={activeTab?.content ?? ''}
            theme={THEME_NAME}
            options={editorOptions}
            beforeMount={handleBeforeMount}
            onMount={handleMount}
            onChange={handleContentChange}
          />
        ) : (
          <DiffEditor
            original={diffPayload?.original ?? activeTab?.content ?? ''}
            modified={diffPayload?.proposed ?? ''}
            language={activeTab?.language ?? 'typescript'}
            theme={THEME_NAME}
            options={{
              ...editorOptions,
              readOnly: true,
              renderSideBySide: sideBySide,
            }}
            beforeMount={handleBeforeMount}
          />
        )}
      </div>
    </div>
  )
}
