/**
 * OutputViewer — right-panel tab that displays syntax-highlighted HCL.
 * Copy-to-clipboard + download-as-main.tf buttons included.
 */

import { useState } from 'react'

interface OutputViewerProps {
  hcl: string | null
  loading: boolean
}

// ─── Minimal HCL token highlighter ────────────────────────────────────────────

const KEYWORDS = /\b(terraform|provider|resource|variable|output|module|data|locals|depends_on|features|required_providers)\b/g
const STRINGS   = /"(?:[^"\\]|\\.)*"/g
const COMMENTS  = /#.*/g
const BOOLEANS  = /\b(true|false|null)\b/g
const NUMBERS   = /\b\d+(\.\d+)?\b/g
const PROP_KEY  = /^(\s*)(\w[\w-]*)(\s*=)/  // leading key on a line

type Span = { text: string; color: string }

function tokeniseLine(line: string): Span[] {
  // We do a single-pass char-by-char tokenisation for correctness at this scale.
  // Strategy: annotate positions, then build spans.
  type Mark = { start: number; end: number; color: string }
  const marks: Mark[] = []

  function scan(re: RegExp, color: string) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(line)) !== null) {
      marks.push({ start: m.index, end: m.index + m[0].length, color })
    }
  }

  // Order matters: comments first (highest priority)
  scan(COMMENTS, '#64748b')
  scan(STRINGS,  '#6ee7b7')
  scan(KEYWORDS, '#f59e0b')
  scan(BOOLEANS, '#c084fc')
  scan(NUMBERS,  '#38bdf8')

  // Property key: word before " = " at line start (not inside comment/string)
  const km = PROP_KEY.exec(line)
  if (km) {
    const start = km[1].length
    const end   = start + km[2].length
    // Only apply if not already claimed by a higher-priority token
    const blocked = marks.some(mk => mk.start < end && mk.end > start)
    if (!blocked) marks.push({ start, end, color: '#93c5fd' })
  }

  if (marks.length === 0) return [{ text: line, color: '#94a3b8' }]

  // Sort by start, resolve overlaps (first wins)
  marks.sort((a, b) => a.start - b.start || b.end - a.end)
  const resolved: Mark[] = []
  let cursor = 0
  for (const mk of marks) {
    if (mk.start < cursor) continue
    resolved.push(mk)
    cursor = mk.end
  }

  const spans: Span[] = []
  cursor = 0
  for (const mk of resolved) {
    if (mk.start > cursor) spans.push({ text: line.slice(cursor, mk.start), color: '#94a3b8' })
    spans.push({ text: line.slice(mk.start, mk.end), color: mk.color })
    cursor = mk.end
  }
  if (cursor < line.length) spans.push({ text: line.slice(cursor), color: '#94a3b8' })

  return spans
}

function HclHighlight({ code }: { code: string }) {
  return (
    <>
      {code.split('\n').map((line, i) => (
        <div key={i} style={{ minHeight: '1.4em' }}>
          {tokeniseLine(line).map((span, j) => (
            <span key={j} style={{ color: span.color }}>{span.text}</span>
          ))}
        </div>
      ))}
    </>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function OutputViewer({ hcl, loading }: OutputViewerProps) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    if (!hcl) return
    navigator.clipboard.writeText(hcl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  function handleDownload() {
    if (!hcl) return
    const blob = new Blob([hcl], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = 'main.tf'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{
      display:        'flex',
      flexDirection:  'column',
      height:         '100%',
      background:     '#0a0f1e',
      borderLeft:     '1px solid #1e293b',
      overflow:       'hidden',
    }}>
      {/* Action bar */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'flex-end',
        gap:            6,
        padding:        '6px 10px',
        borderBottom:   '1px solid #1e293b',
        flexShrink:     0,
      }}>
        <button
          onClick={handleCopy}
          disabled={!hcl}
          style={actionBtn(!hcl)}
          title="Copy to clipboard"
        >
          {copied ? 'COPIED' : 'COPY'}
        </button>
        <button
          onClick={handleDownload}
          disabled={!hcl}
          style={actionBtn(!hcl)}
          title="Download main.tf"
        >
          .TF
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '10px 12px' }}>
        {loading && (
          <div style={{ color: '#475569', fontSize: 11, letterSpacing: '0.05em' }}>
            Generating…
          </div>
        )}
        {!loading && hcl && (
          <pre style={{
            margin: 0, padding: 0,
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: 11,
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}>
            <HclHighlight code={hcl} />
          </pre>
        )}
        {!loading && !hcl && (
          <div style={{
            color: '#1e293b',
            fontSize: 11,
            letterSpacing: '0.07em',
            paddingTop: 40,
            textAlign: 'center',
          }}>
            PRESS TERRAFORM TO GENERATE HCL
          </div>
        )}
      </div>
    </div>
  )
}

function actionBtn(disabled: boolean): React.CSSProperties {
  return {
    background:    '#1e293b',
    border:        `1px solid ${disabled ? '#1e293b' : '#334155'}`,
    color:         disabled ? '#1e293b' : '#6ee7b7',
    fontSize:      9,
    fontWeight:    700,
    padding:       '2px 7px',
    borderRadius:  2,
    cursor:        disabled ? 'default' : 'pointer',
    letterSpacing: '0.07em',
    fontFamily:    'var(--font-mono, monospace)',
  }
}
