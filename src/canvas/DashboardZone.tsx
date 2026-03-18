import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useWindowManagerStore } from '../store/windowManagerStore'
import { PANEL_REGISTRY } from '../panels/PANEL_REGISTRY'
import type { LayoutDirective, LayoutPreset, PanelType } from '../types'
import ArchitectureDashboard from '../panels/ArchitectureDashboard/ArchitectureDashboard'

const FALLBACK_LAYOUT: LayoutDirective = {
  focus: 'map',
  support: ['context', 'log', 'delta'],
  reason: 'default',
}

// ─── Memoized panel shell ─────────────────────────────────────────────────────
// React.memo prevents panel contents from re-rendering during resize drags
const DashboardPanel = React.memo(function DashboardPanel({
  panelType,
  slot,
}: {
  panelType: PanelType
  slot: string
}) {
  const def = PANEL_REGISTRY[panelType]
  const Component = def?.component
  return (
    <div className="dash-panel" data-slot={slot}>
      <div className="dash-panel__header">
        <span className="dash-panel__icon">{def?.icon ?? '◻'}</span>
        <span className="dash-panel__label">{def?.label ?? panelType}</span>
        {slot === 'focus' && <span className="dash-panel__focus-badge">FOCUS</span>}
      </div>
      <div className="dash-panel__content">
        {Component ? (
          <Component />
        ) : (
          <div className="canvas-panel-placeholder">
            <span>{panelType}</span>
          </div>
        )}
      </div>
    </div>
  )
})

// ─── Preset dashboard ─────────────────────────────────────────────────────────
// Uses NESTED FLEX (not CSS grid) so handles sit inline between exactly the
// panels they divide. Each panel is its own div; handles are flex children.
//
// Structure A — side-by-side (Intelligence):
//   [left | x-handle | right]
//
// Structure B — left full-height, right stacked (Analysis, Trading):
//   [left | x-handle | (top-right / y-handle / bottom-right)]
//
// Structure C — top split, bottom full-width (Monitor):
//   [(top-left | x-handle | top-right) / y-handle / bottom]

type StructA = { type: 'A'; left: string; right: string }
type StructB = { type: 'B'; left: string; topRight: string; bottomRight: string }
// Structure E: full-width top panel + three equal panels along the bottom
type StructE = { type: 'E'; top: string; bottomLeft: string; bottomMid: string; bottomRight: string }

const PRESET_STRUCTURES: Record<string, StructA | StructB | StructE> = {
  intelligence: { type: 'A', left: 'context', right: 'map' },
  engineering:  { type: 'B', left: 'context', topRight: 'delta', bottomRight: 'log' },
  trading:      { type: 'E', top: 'trading', bottomLeft: 'signal-intel', bottomMid: 'trade-engine', bottomRight: 'strategy-monitor' },
}

const clampRatio = (r: number) => Math.min(0.85, Math.max(0.15, r))

function PresetDashboard({ preset }: { preset: LayoutPreset }) {
  const s = PRESET_STRUCTURES[preset.id]

  const colParts = preset.gridCols.split(' ').map(parseFloat)
  const rowParts = preset.gridRows.split(' ').map(parseFloat)
  const initCol = colParts.length > 1 ? colParts[0] / (colParts[0] + colParts[1]) : 0.5
  const initRow = rowParts.length > 1 ? rowParts[0] / (rowParts[0] + rowParts[1]) : 0.6

  const [colRatio, setColRatio] = useState(initCol)
  const [rowRatio, setRowRatio] = useState(initRow)

  // E-layout: three bottom panels, two independent col splits
  const [eColA, setEColA] = useState(0.333)  // left / mid split
  const [eColB, setEColB] = useState(0.5)    // mid / right split (as fraction of remaining)

  const outerRef      = useRef<HTMLDivElement>(null)
  const topPanelRef   = useRef<HTMLDivElement>(null)
  const colPrimaryRef = useRef<HTMLDivElement>(null)
  const rowPrimaryRef = useRef<HTMLDivElement>(null)
  const eLeftRef      = useRef<HTMLDivElement>(null)
  const eMidRef       = useRef<HTMLDivElement>(null)
  const bottomRowRef  = useRef<HTMLDivElement>(null)

  const onColDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const measure = outerRef.current
    const primary = colPrimaryRef.current
    if (!measure || !primary) return
    const startX = e.clientX
    const startRatio = colRatio
    const onMove = (ev: MouseEvent) => {
      const r = clampRatio(startRatio + (ev.clientX - startX) / measure.getBoundingClientRect().width)
      primary.style.flexBasis = `${r * 100}%`
    }
    const onUp = (ev: MouseEvent) => {
      setColRatio(clampRatio(startRatio + (ev.clientX - startX) / measure.getBoundingClientRect().width))
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [colRatio])

  const onRowDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const measure = outerRef.current
    const primary = s.type === 'E' ? topPanelRef.current : rowPrimaryRef.current
    if (!measure || !primary) return
    const startY = e.clientY
    const startRatio = rowRatio
    const onMove = (ev: MouseEvent) => {
      const r = clampRatio(startRatio + (ev.clientY - startY) / measure.getBoundingClientRect().height)
      primary.style.flexBasis = `${r * 100}%`
    }
    const onUp = (ev: MouseEvent) => {
      setRowRatio(clampRatio(startRatio + (ev.clientY - startY) / measure.getBoundingClientRect().height))
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [rowRatio, s.type])

  // E-layout col resize: handle between left and mid
  const onEColADown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const row = bottomRowRef.current
    const left = eLeftRef.current
    if (!row || !left) return
    const startX = e.clientX
    const startA = eColA
    const onMove = (ev: MouseEvent) => {
      const r = clampRatio(startA + (ev.clientX - startX) / row.getBoundingClientRect().width)
      left.style.flexBasis = `${r * 100}%`
    }
    const onUp = (ev: MouseEvent) => {
      setEColA(clampRatio(startA + (ev.clientX - startX) / row.getBoundingClientRect().width))
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [eColA])

  // E-layout col resize: handle between mid and right
  const onEColBDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const mid = eMidRef.current
    if (!mid) return
    const startX = e.clientX
    const startB = eColB
    // mid flex-basis is relative to the remaining space after left
    const onMove = (ev: MouseEvent) => {
      const row = bottomRowRef.current
      if (!row) return
      const totalW = row.getBoundingClientRect().width
      const leftW = eColA * totalW
      const remaining = totalW - leftW
      const r = clampRatio(startB + (ev.clientX - startX) / remaining)
      mid.style.flexBasis = `${r * 100}%`
    }
    const onUp = (ev: MouseEvent) => {
      const row = bottomRowRef.current
      if (!row) return
      const totalW = row.getBoundingClientRect().width
      const leftW = eColA * totalW
      const remaining = totalW - leftW
      setEColB(clampRatio(startB + (ev.clientX - startX) / remaining))
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [eColA, eColB])

  const panel = (area: string) => {
    const slot = preset.slots.find((sl) => sl.area === area)!
    return <DashboardPanel panelType={slot.panelType} slot={slot.area} />
  }

  // ── Structure A: [left | x-handle | right] ──────────────────────────────────
  if (s.type === 'A') {
    return (
      <div ref={outerRef} className="dashboard-zone">
        <div ref={colPrimaryRef} style={{ flexBasis: `${colRatio * 100}%`, flexShrink: 0, minWidth: 0 }}>
          {panel(s.left)}
        </div>
        <div className="dash-resize-handle--inline dash-resize-handle--x" onMouseDown={onColDown} />
        <div style={{ flex: '1 1 0', minWidth: 0 }}>
          {panel(s.right)}
        </div>
      </div>
    )
  }

  // ── Structure B: [left | x-handle | (topRight / y-handle / bottomRight)] ────
  if (s.type === 'B') {
    return (
      <div ref={outerRef} className="dashboard-zone">
        <div ref={colPrimaryRef} style={{ flexBasis: `${colRatio * 100}%`, flexShrink: 0, minWidth: 0 }}>
          {panel(s.left)}
        </div>
        <div className="dash-resize-handle--inline dash-resize-handle--x" onMouseDown={onColDown} />
        <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div ref={rowPrimaryRef} style={{ flexBasis: `${rowRatio * 100}%`, flexShrink: 0, minHeight: 0 }}>
            {panel(s.topRight)}
          </div>
          <div className="dash-resize-handle--inline dash-resize-handle--y" onMouseDown={onRowDown} />
          <div style={{ flex: '1 1 0', minHeight: 0 }}>
            {panel(s.bottomRight)}
          </div>
        </div>
      </div>
    )
  }

  // ── Structure E: top full-width / y-handle / (left | x | mid | x | right) ──
  return (
    <div ref={outerRef} className="dashboard-zone" style={{ flexDirection: 'column' }}>
      <div ref={topPanelRef} style={{ flexBasis: `${rowRatio * 100}%`, flexShrink: 0, minHeight: 0 }}>
        {panel(s.top)}
      </div>
      <div className="dash-resize-handle--inline dash-resize-handle--y" onMouseDown={onRowDown} />
      <div ref={bottomRowRef} style={{ flex: '1 1 0', minHeight: 0, display: 'flex' }}>
        <div ref={eLeftRef} style={{ flexBasis: `${eColA * 100}%`, flexShrink: 0, minWidth: 0 }}>
          {panel(s.bottomLeft)}
        </div>
        <div className="dash-resize-handle--inline dash-resize-handle--x" onMouseDown={onEColADown} />
        <div ref={eMidRef} style={{ flexBasis: `${eColB * 100}%`, flexShrink: 0, minWidth: 0 }}>
          {panel(s.bottomMid)}
        </div>
        <div className="dash-resize-handle--inline dash-resize-handle--x" onMouseDown={onEColBDown} />
        <div style={{ flex: '1 1 0', minWidth: 0 }}>
          {panel(s.bottomRight)}
        </div>
      </div>
    </div>
  )
}

// ─── AI directive dashboard ───────────────────────────────────────────────────
// 60/40 flex-column layout. Handles are inline (in-flow flex children) so they
// sit exactly at the visible border between panels — no guesswork needed.
function AIDashboard({ layout }: { layout: LayoutDirective }) {
  const supportPanels = layout.support.slice(0, 3)
  const N = supportPanels.length

  const containerRef = useRef<HTMLDivElement>(null)
  const focusDivRef = useRef<HTMLDivElement>(null)
  const supportRowRef = useRef<HTMLDivElement>(null)
  const panelRefs = useRef<(HTMLDivElement | null)[]>([])

  const [focusRatio, setFocusRatio] = useState(0.6)
  const [supportWidths, setSupportWidths] = useState<number[]>(() => Array(N).fill(1))

  // Reset support widths when panel count changes (new directive)
  useEffect(() => {
    setSupportWidths(Array(N).fill(1))
    panelRefs.current = []
  }, [N])

  // ── Focus / support-row vertical split ──
  const onFocusHandleDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const container = containerRef.current
    const focusDiv = focusDivRef.current
    if (!container || !focusDiv) return

    const startY = e.clientY
    const startRatio = focusRatio

    const onMove = (ev: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      const r = Math.min(0.8, Math.max(0.2, startRatio + (ev.clientY - startY) / rect.height))
      focusDiv.style.height = `${r * 100}%`
    }

    const onUp = (ev: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      const r = Math.min(0.8, Math.max(0.2, startRatio + (ev.clientY - startY) / rect.height))
      setFocusRatio(r)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [focusRatio])

  // ── Support panel horizontal splits ──
  const getSupportHandleDown = useCallback((idx: number) => (e: React.MouseEvent) => {
    e.preventDefault()
    const row = supportRowRef.current
    if (!row) return

    const startX = e.clientX
    const startWidths = [...supportWidths]
    const total = startWidths.reduce((a, b) => a + b, 0)
    const min = 0.15 * total

    const onMove = (ev: MouseEvent) => {
      const rowWidth = row.getBoundingClientRect().width
      const delta = ((ev.clientX - startX) / rowWidth) * total
      const newWidths = [...startWidths]
      newWidths[idx] = Math.max(min, startWidths[idx] + delta)
      newWidths[idx + 1] = Math.max(min, startWidths[idx + 1] - delta)

      // DOM-direct update — no re-renders
      const newTotal = newWidths.reduce((a, b) => a + b, 0)
      panelRefs.current.forEach((el, i) => {
        if (el) el.style.flex = String((newWidths[i] ?? 1) / newTotal * N)
      })
    }

    const onUp = (ev: MouseEvent) => {
      const rowWidth = row.getBoundingClientRect().width
      const delta = ((ev.clientX - startX) / rowWidth) * total
      const newWidths = [...startWidths]
      newWidths[idx] = Math.max(min, startWidths[idx] + delta)
      newWidths[idx + 1] = Math.max(min, startWidths[idx + 1] - delta)
      setSupportWidths(newWidths)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [supportWidths, N])

  return (
    <div ref={containerRef} className="dashboard-zone dashboard-zone--ai">
      {/* Focus panel */}
      <div
        ref={focusDivRef}
        className="dash-slot dash-slot--focus"
        style={{ flex: 'none', height: `${focusRatio * 100}%` }}
      >
        <DashboardPanel panelType={layout.focus} slot="focus" />
      </div>

      {/* Inline handle — sits exactly at the border, invisible until hovered */}
      <div
        className="dash-resize-handle--inline dash-resize-handle--y"
        onMouseDown={onFocusHandleDown}
      />

      {/* Support panels with handles between them */}
      <div ref={supportRowRef} className="dash-slot dash-slot--support-row" style={{ flex: 1 }}>
        {supportPanels.map((type, i) => (
          <React.Fragment key={type}>
            <div
              ref={(el) => { panelRefs.current[i] = el }}
              className="dash-slot--support"
              style={{ flex: supportWidths[i] }}
            >
              <DashboardPanel panelType={type} slot="support" />
            </div>
            {i < supportPanels.length - 1 && (
              <div
                className="dash-resize-handle--inline dash-resize-handle--x"
                onMouseDown={getSupportHandleDown(i)}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function DashboardZone() {
  const activePreset = useWindowManagerStore((s) => s.activePreset)
  const currentLayout = useWindowManagerStore((s) => s.currentLayout)

  // Standalone dashboards replace the entire zone with their own layout
  if (activePreset?.standalone) {
    if (activePreset.id === 'architecture') return <ArchitectureDashboard />
  }

  if (activePreset) return <PresetDashboard preset={activePreset} />
  return <AIDashboard layout={currentLayout ?? FALLBACK_LAYOUT} />
}
