import { useEffect, useRef, useState } from 'react'
import type { Node } from '@xyflow/react'
import type { ArchimateNodeData } from './archimate-shapes'

// ─── Layer metadata (mirrors archimate-shapes.tsx constants) ──────────────────
const LAYER_LABEL: Record<string, string> = {
  business:    'BUSINESS',
  application: 'APPLICATION',
  technology:  'TECHNOLOGY',
  motivation:  'MOTIVATION',
}

const LAYER_COLOR: Record<string, string> = {
  business:    '#b8860b',
  application: '#1e40af',
  technology:  '#2d6a2d',
  motivation:  '#6b21a8',
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PropertyEditorProps {
  node: Node | null
  onUpdate: (id: string, patch: Partial<ArchimateNodeData>) => void
  onClose: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Field({
  label, value, onChange, placeholder, monospace = false,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  monospace?: boolean
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ color: '#64748b', fontSize: 10, letterSpacing: '0.08em', marginBottom: 4 }}>
        {label}
      </div>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: 3,
          color: '#e2e8f0',
          fontSize: monospace ? 11 : 12,
          fontFamily: monospace ? 'var(--font-mono, monospace)' : 'inherit',
          padding: '5px 8px',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PropertyEditor({ node, onUpdate, onClose }: PropertyEditorProps) {
  const data = node?.data as ArchimateNodeData | undefined

  const [label,        setLabel]        = useState('')
  const [providerType, setProviderType] = useState('')
  const [codeRef,      setCodeRef]      = useState('')
  const [propsJson,    setPropsJson]    = useState('')
  const [jsonError,    setJsonError]    = useState(false)
  const [copied,       setCopied]       = useState(false)

  // Re-populate form when selected node changes
  useEffect(() => {
    if (!data) return
    setLabel(String(data.label ?? ''))
    setProviderType(String(data.providerType ?? ''))
    setCodeRef(String(data.codeRef ?? ''))
    setPropsJson(
      data.properties && Object.keys(data.properties).length > 0
        ? JSON.stringify(data.properties, null, 2)
        : ''
    )
    setJsonError(false)
  }, [node?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const commitRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function scheduleCommit(patch: Partial<ArchimateNodeData>) {
    if (!node) return
    if (commitRef.current) clearTimeout(commitRef.current)
    commitRef.current = setTimeout(() => {
      onUpdate(node.id, patch)
    }, 400)
  }

  function handleLabelChange(v: string) {
    setLabel(v)
    scheduleCommit({ label: v })
  }

  function handleProviderTypeChange(v: string) {
    setProviderType(v)
    scheduleCommit({ providerType: v || undefined })
  }

  function handleCodeRefChange(v: string) {
    setCodeRef(v)
    scheduleCommit({ codeRef: v || undefined })
  }

  function handlePropsChange(v: string) {
    setPropsJson(v)
    if (!v.trim()) {
      setJsonError(false)
      scheduleCommit({ properties: {} })
      return
    }
    try {
      const parsed = JSON.parse(v) as Record<string, unknown>
      setJsonError(false)
      scheduleCommit({ properties: parsed })
    } catch {
      setJsonError(true)
    }
  }

  function handleCopyCodeRef() {
    if (!codeRef) return
    navigator.clipboard.writeText(codeRef).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const layer = (data as { layer?: string } | undefined)?.layer ?? ''
  const archmateType = node?.type ?? ''

  if (!node) {
    return (
      <div style={PANEL_STYLE}>
        <div style={HEADER_STYLE}>
          <span style={{ color: '#64748b', fontSize: 11 }}>PROPERTIES</span>
        </div>
        <div style={{ padding: '24px 16px', color: '#334155', fontSize: 11, textAlign: 'center' }}>
          Select a node to edit its properties.
        </div>
      </div>
    )
  }

  return (
    <div style={PANEL_STYLE}>
      {/* Header */}
      <div style={HEADER_STYLE}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
          {layer && (
            <span style={{
              background: LAYER_COLOR[layer] ?? '#334155',
              color: '#fff',
              fontSize: 9, fontWeight: 700,
              padding: '1px 5px', borderRadius: 2,
              letterSpacing: '0.07em',
              flexShrink: 0,
            }}>
              {LAYER_LABEL[layer] ?? layer.toUpperCase()}
            </span>
          )}
          <span style={{ color: '#94a3b8', fontSize: 10, letterSpacing: '0.07em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {archmateType}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 14, padding: '0 2px', flexShrink: 0 }}
          title="Close property editor"
        >
          ×
        </button>
      </div>

      {/* ID (read-only) */}
      <div style={{ padding: '8px 14px 0' }}>
        <div style={{ color: '#64748b', fontSize: 10, letterSpacing: '0.08em', marginBottom: 4 }}>ID</div>
        <div style={{ color: '#475569', fontSize: 10, fontFamily: 'var(--font-mono, monospace)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.id}
        </div>
      </div>

      {/* Editable fields */}
      <div style={{ padding: '12px 14px', flex: 1, overflow: 'auto' }}>
        <Field label="LABEL" value={label} onChange={handleLabelChange} placeholder="Node label" />

        <Field
          label="PROVIDER TYPE"
          value={providerType}
          onChange={handleProviderTypeChange}
          placeholder="e.g. azurerm_resource_group"
          monospace
        />

        {/* codeRef with copy button */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ color: '#64748b', fontSize: 10, letterSpacing: '0.08em', marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>CODE REF</span>
            {codeRef && (
              <button
                onClick={handleCopyCodeRef}
                style={{
                  background: 'none', border: 'none',
                  color: copied ? '#6ee7b7' : '#475569',
                  cursor: 'pointer', fontSize: 9,
                  padding: 0, letterSpacing: '0.07em',
                }}
                title="Copy path to clipboard"
              >
                {copied ? '✓ COPIED' : 'COPY'}
              </button>
            )}
          </div>
          <input
            value={codeRef}
            onChange={e => handleCodeRefChange(e.target.value)}
            placeholder="e.g. ./src/services/api.ts"
            style={{
              width: '100%',
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 3,
              color: codeRef ? '#6ee7b7' : '#e2e8f0',
              fontSize: 11,
              fontFamily: 'var(--font-mono, monospace)',
              padding: '5px 8px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* properties JSON editor */}
        <div style={{ marginBottom: 12 }}>
          <div style={{
            color: '#64748b', fontSize: 10, letterSpacing: '0.08em', marginBottom: 4,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span>PROPERTIES</span>
            {jsonError && <span style={{ color: '#ef4444', fontSize: 9 }}>INVALID JSON</span>}
          </div>
          <textarea
            value={propsJson}
            onChange={e => handlePropsChange(e.target.value)}
            placeholder='{ "name": "...", "location": "..." }'
            rows={6}
            spellCheck={false}
            style={{
              width: '100%',
              background: '#1e293b',
              border: `1px solid ${jsonError ? '#ef4444' : '#334155'}`,
              borderRadius: 3,
              color: '#e2e8f0',
              fontSize: 10,
              fontFamily: 'var(--font-mono, monospace)',
              padding: '5px 8px',
              outline: 'none',
              resize: 'vertical',
              boxSizing: 'border-box',
              lineHeight: 1.5,
            }}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const PANEL_STYLE: React.CSSProperties = {
  width: 220,
  flexShrink: 0,
  background: '#0f172a',
  borderLeft: '1px solid #1e293b',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}

const HEADER_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 14px',
  borderBottom: '1px solid #1e293b',
  background: '#0f172a',
  gap: 8,
  flexShrink: 0,
}
