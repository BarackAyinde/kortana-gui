/**
 * ArchiMate 3 shape library for @xyflow/react
 *
 * Exports:
 *   ArchimateNodes     — pass to <ReactFlow nodeTypes={ArchimateNodes} />
 *   ArchimateEdgeTypes — pass to <ReactFlow edgeTypes={ArchimateEdgeTypes} />
 *
 * Usage note: set connectionMode="loose" on ReactFlow so every handle can be
 * both source and target (required for ArchiMate's undirected relationships).
 */

import { useState } from 'react'
import {
  Handle,
  Position,
  getBezierPath,
  type NodeProps,
  type EdgeProps,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react'

// ─── Public types ─────────────────────────────────────────────────────────────

export type ArchimateNodeData = {
  label: string
  providerType?: string           // e.g. "azurerm_resource_group" → enables HCL generation
  properties?: Record<string, unknown>
  codeRef?: string                // e.g. "./src/index.ts" → KORTANA_NAVIGATE on click
  [key: string]: unknown          // React Flow requires an index signature on node data
}

// ─── Layer palette ────────────────────────────────────────────────────────────

type Layer = 'business' | 'application' | 'technology' | 'motivation'

const LAYER: Record<Layer, { bg: string; border: string; text: string; badge: string }> = {
  business:    { bg: '#2a1e00', border: '#b8860b', text: '#ffd700', badge: '#b8860b' },
  application: { bg: '#0c1730', border: '#1e40af', text: '#93c5fd', badge: '#1e40af' },
  technology:  { bg: '#0a1a0a', border: '#2d6a2d', text: '#d1fae5', badge: '#2d6a2d' },
  motivation:  { bg: '#1a0933', border: '#6b21a8', text: '#e9d5ff', badge: '#6b21a8' },
}

// ─── Shape registry ───────────────────────────────────────────────────────────
// abbr: the 2-char type indicator shown in the top-right corner of each node

const SHAPES: Record<string, { layer: Layer; abbr: string }> = {
  // Business layer
  BusinessProcess:  { layer: 'business',    abbr: 'BP' },
  BusinessActor:    { layer: 'business',    abbr: 'BA' },
  BusinessRole:     { layer: 'business',    abbr: 'BR' },
  BusinessService:  { layer: 'business',    abbr: 'BS' },
  // Application layer
  AppComponent:     { layer: 'application', abbr: 'AC' },
  AppService:       { layer: 'application', abbr: 'AS' },
  AppInterface:     { layer: 'application', abbr: 'AI' },
  DataObject:       { layer: 'application', abbr: 'DO' },
  // Technology layer
  TechNode:         { layer: 'technology',  abbr: 'TN' },
  TechService:      { layer: 'technology',  abbr: 'TS' },
  Database:         { layer: 'technology',  abbr: 'DB' },
  Network:          { layer: 'technology',  abbr: 'NW' },
  // Motivation layer
  Goal:             { layer: 'motivation',  abbr: 'GL' },
  Principle:        { layer: 'motivation',  abbr: 'PR' },
  ArchRequirement:  { layer: 'motivation',  abbr: 'RQ' },
  ArchConstraint:   { layer: 'motivation',  abbr: 'CN' },
}

// ─── SVG helpers (used by custom edge components) ─────────────────────────────

// Angle (radians) that an edge arrow should point when arriving at a target handle
const TARGET_ANGLE: Record<Position, number> = {
  [Position.Left]:   0,             // edge arrives from the left  → arrow points right
  [Position.Right]:  Math.PI,       // edge arrives from the right → arrow points left
  [Position.Top]:    Math.PI / 2,   // edge arrives from above     → arrow points down
  [Position.Bottom]: -Math.PI / 2,  // edge arrives from below     → arrow points up
}

// Angle that an edge decoration (e.g. diamond) should extend outward from a source handle
const SOURCE_ANGLE: Record<Position, number> = {
  [Position.Right]:  0,
  [Position.Left]:   Math.PI,
  [Position.Bottom]: Math.PI / 2,
  [Position.Top]:    -Math.PI / 2,
}

// Arrowhead: solid (filled) or open (outline only)
function Arrow({
  x, y, pos, size = 7, filled, color,
}: {
  x: number; y: number; pos: Position; size?: number; filled: boolean; color: string
}) {
  const a = TARGET_ANGLE[pos]
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  const hw = size * 0.55
  const pts = [
    `${x},${y}`,
    `${x - size * cos + hw * sin},${y - size * sin - hw * cos}`,
    `${x - size * cos - hw * sin},${y - size * sin + hw * cos}`,
  ].join(' ')
  return (
    <polygon
      points={pts}
      fill={filled ? color : '#0f172a'}
      stroke={color}
      strokeWidth={1.5}
      strokeLinejoin="round"
    />
  )
}

// Diamond: filled (composition) or open/outline (aggregation), placed at source
function Diamond({
  x, y, pos, size = 9, filled, color,
}: {
  x: number; y: number; pos: Position; size?: number; filled: boolean; color: string
}) {
  const a = SOURCE_ANGLE[pos]
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  const hw = size * 0.5
  // 4 points: tip (outward from source), side, back (at node surface), side
  const pts = [
    `${x + size * cos},${y + size * sin}`,
    `${x + hw * sin},${y - hw * cos}`,
    `${x - size * cos},${y - size * sin}`,
    `${x - hw * sin},${y + hw * cos}`,
  ].join(' ')
  return (
    <polygon
      points={pts}
      fill={filled ? color : '#0f172a'}
      stroke={color}
      strokeWidth={1.5}
      strokeLinejoin="round"
    />
  )
}

// Small filled dot at target (used by Assignment)
function Dot({ x, y, r = 5, color }: { x: number; y: number; r?: number; color: string }) {
  return <circle cx={x} cy={y} r={r} fill={color} />
}

// ─── Node factory ─────────────────────────────────────────────────────────────

const HANDLE_POSITIONS = [Position.Top, Position.Right, Position.Bottom, Position.Left] as const

function makeNode(shapeName: string) {
  const meta = SHAPES[shapeName]
  const s = LAYER[meta.layer]

  function ArchimateNode({ data, selected }: NodeProps) {
    const d = data as ArchimateNodeData
    const [editing, setEditing] = useState(false)
    const [label, setLabel] = useState(String(d.label ?? ''))

    return (
      <div
        style={{
          background: s.bg,
          border: `1.5px solid ${selected ? '#e2e8f0' : s.border}`,
          borderRadius: 3,
          padding: '22px 10px 8px',
          minWidth: 120,
          minHeight: 46,
          position: 'relative',
          fontFamily: 'var(--font-mono, monospace)',
          boxShadow: selected ? `0 0 0 2px ${s.border}66` : undefined,
          cursor: 'default',
        }}
      >
        {/* Type badge — top-right */}
        <span
          style={{
            position: 'absolute', top: 4, right: 4,
            background: s.badge, color: '#fff',
            fontSize: 9, fontWeight: 700,
            padding: '1px 4px', borderRadius: 2,
            letterSpacing: '0.07em',
            fontFamily: 'var(--font-mono, monospace)',
          }}
        >
          {meta.abbr}
        </span>

        {/* Provider indicator — top-left, only when providerType is set */}
        {d.providerType && (
          <span
            title={d.providerType}
            style={{
              position: 'absolute', top: 4, left: 4,
              color: '#6ee7b7', fontSize: 9, lineHeight: 1,
            }}
          >
            ⬡
          </span>
        )}

        {/* Label — double-click to edit inline */}
        {editing ? (
          <input
            autoFocus
            defaultValue={label}
            onChange={e => setLabel(e.target.value)}
            onBlur={() => setEditing(false)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === 'Escape') setEditing(false)
            }}
            style={{
              background: 'transparent', border: 'none',
              color: s.text, fontSize: 11, width: '100%',
              outline: 'none', fontFamily: 'inherit', textAlign: 'center',
            }}
          />
        ) : (
          <div
            onDoubleClick={() => setEditing(true)}
            style={{
              color: s.text, fontSize: 11, textAlign: 'center',
              userSelect: 'none', lineHeight: 1.4,
            }}
          >
            {label || <span style={{ opacity: 0.3, fontStyle: 'italic' }}>label</span>}
          </div>
        )}

        {/* Connection handles — all 4 sides; set connectionMode="loose" in ReactFlow */}
        {HANDLE_POSITIONS.map(pos => (
          <Handle
            key={pos}
            type="source"
            position={pos}
            id={pos}
            style={{
              background: s.border,
              width: 7, height: 7,
              border: `1px solid ${s.bg}`,
            }}
          />
        ))}
      </div>
    )
  }

  ArchimateNode.displayName = `Arch_${shapeName}`
  return ArchimateNode
}

// ─── Edge factory ─────────────────────────────────────────────────────────────

const EDGE_COLOR          = '#475569'
const EDGE_COLOR_SELECTED = '#94a3b8'

type EdgeVariant =
  | { kind: 'simple';  dashed?: boolean; thick?: boolean; arrow: 'none' | 'open' | 'closed' }
  | { kind: 'diamond'; filled: boolean }
  | { kind: 'dot' }

function makeEdge(variant: EdgeVariant) {
  return function ArchimateEdge({
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition, selected,
  }: EdgeProps) {
    const [path] = getBezierPath({
      sourceX, sourceY, sourcePosition,
      targetX, targetY, targetPosition,
    })
    const color = selected ? EDGE_COLOR_SELECTED : EDGE_COLOR

    if (variant.kind === 'diamond') {
      return (
        <g>
          <path d={path} fill="none" stroke={color} strokeWidth={1.5} />
          <Diamond x={sourceX} y={sourceY} pos={sourcePosition} filled={variant.filled} color={color} />
        </g>
      )
    }

    if (variant.kind === 'dot') {
      return (
        <g>
          <path d={path} fill="none" stroke={color} strokeWidth={1.5} />
          <Dot x={targetX} y={targetY} color={color} />
        </g>
      )
    }

    // kind === 'simple'
    return (
      <g>
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={variant.thick ? 2.5 : 1.5}
          strokeDasharray={variant.dashed ? '5 3' : undefined}
        />
        {variant.arrow === 'open' && (
          <Arrow x={targetX} y={targetY} pos={targetPosition} filled={false} color={color} />
        )}
        {variant.arrow === 'closed' && (
          <Arrow x={targetX} y={targetY} pos={targetPosition} filled={true} color={color} />
        )}
      </g>
    )
  }
}

// ─── Public exports ───────────────────────────────────────────────────────────

/** Pass to <ReactFlow nodeTypes={ArchimateNodes} /> */
export const ArchimateNodes: NodeTypes = Object.fromEntries(
  Object.keys(SHAPES).map(name => [name, makeNode(name)])
)

/**
 * Pass to <ReactFlow edgeTypes={ArchimateEdgeTypes} />.
 *
 * Edge type visual guide:
 *   association  — dashed line, no arrow        (undirected relationship)
 *   serving      — solid line, open arrow       (one element provides service to another)
 *   realisation  — dashed line, open arrow      (logic is realised by a lower layer element)
 *   composition  — solid line, FILLED diamond   (whole owns its parts; parts cannot exist alone)
 *   aggregation  — solid line, OPEN diamond     (whole groups its parts; parts can exist alone)
 *   assignment   — solid line, filled dot       (maps roles/actors to behaviour elements)
 *   triggering   — solid line, filled arrow     (causal ordering between behaviour elements)
 *   flow         — THICK line, filled arrow     (transfer of information, goods, money)
 */
export const ArchimateEdgeTypes: EdgeTypes = {
  association:  makeEdge({ kind: 'simple',  dashed: true,  arrow: 'none'   }),
  serving:      makeEdge({ kind: 'simple',               arrow: 'open'   }),
  realisation:  makeEdge({ kind: 'simple',  dashed: true,  arrow: 'open'   }),
  composition:  makeEdge({ kind: 'diamond',               filled: true    }),
  aggregation:  makeEdge({ kind: 'diamond',               filled: false   }),
  assignment:   makeEdge({ kind: 'dot'                                    }),
  triggering:   makeEdge({ kind: 'simple',               arrow: 'closed'  }),
  flow:         makeEdge({ kind: 'simple',  thick: true,  arrow: 'closed'  }),
}
