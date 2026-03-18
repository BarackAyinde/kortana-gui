/**
 * Architecture Dashboard — Session 2
 *
 * Standalone dashboard (not a panel) mounted when activePreset.id === 'architecture'.
 * Layout: top toolbar | left palette | ReactFlow canvas | right PropertyEditor
 *
 * Canvas state persists to localStorage (kortana.arch.canvas).
 * Architecture nodes sync to context store at localhost:4000 (type='Architecture').
 * Node body stores canvas metadata as JSON: { archmateType, layer, rfX, rfY, providerType, properties, codeRef }
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  ConnectionMode,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ArchimateNodes, ArchimateEdgeTypes, type ArchimateNodeData } from './archimate-shapes'
import PropertyEditor from './PropertyEditor'
import OutputViewer from './OutputViewer'

// ─── Constants ────────────────────────────────────────────────────────────────

const CONTEXT_STORE = 'http://localhost:4000'
const ARCH_CANVAS_KEY = 'kortana.arch.canvas'
const SESSION_ID = 'kortana-arch'

type Layer = 'business' | 'application' | 'technology' | 'motivation'

const LAYER_COLOR: Record<Layer, string> = {
  business:    '#b8860b',
  application: '#1e40af',
  technology:  '#2d6a2d',
  motivation:  '#6b21a8',
}

const LAYER_LABEL: Record<Layer, string> = {
  business:    'BUSINESS',
  application: 'APPLICATION',
  technology:  'TECHNOLOGY',
  motivation:  'MOTIVATION',
}

const EDGE_TYPE_LABELS: Record<string, string> = {
  association:  'Association',
  serving:      'Serving',
  realisation:  'Realisation',
  composition:  'Composition',
  aggregation:  'Aggregation',
  assignment:   'Assignment',
  triggering:   'Triggering',
  flow:         'Flow',
}

// Palette shape definitions
const PALETTE: { type: string; label: string; layer: Layer; abbr: string }[] = [
  // Business
  { type: 'BusinessProcess',  label: 'Process',    layer: 'business',    abbr: 'BP' },
  { type: 'BusinessActor',    label: 'Actor',      layer: 'business',    abbr: 'BA' },
  { type: 'BusinessRole',     label: 'Role',       layer: 'business',    abbr: 'BR' },
  { type: 'BusinessService',  label: 'Service',    layer: 'business',    abbr: 'BS' },
  // Application
  { type: 'AppComponent',     label: 'Component',  layer: 'application', abbr: 'AC' },
  { type: 'AppService',       label: 'Service',    layer: 'application', abbr: 'AS' },
  { type: 'AppInterface',     label: 'Interface',  layer: 'application', abbr: 'AI' },
  { type: 'DataObject',       label: 'Data',       layer: 'application', abbr: 'DO' },
  // Technology
  { type: 'TechNode',         label: 'Node',       layer: 'technology',  abbr: 'TN' },
  { type: 'TechService',      label: 'Service',    layer: 'technology',  abbr: 'TS' },
  { type: 'Database',         label: 'Database',   layer: 'technology',  abbr: 'DB' },
  { type: 'Network',          label: 'Network',    layer: 'technology',  abbr: 'NW' },
  // Motivation
  { type: 'Goal',             label: 'Goal',       layer: 'motivation',  abbr: 'GL' },
  { type: 'Principle',        label: 'Principle',  layer: 'motivation',  abbr: 'PR' },
  { type: 'ArchRequirement',  label: 'Req.',       layer: 'motivation',  abbr: 'RQ' },
  { type: 'ArchConstraint',   label: 'Constraint', layer: 'motivation',  abbr: 'CN' },
]

// Maps archmateType → layer (used when creating nodes and syncing to store)
const TYPE_LAYER: Record<string, Layer> = Object.fromEntries(
  PALETTE.map(p => [p.type, p.layer])
)

// ─── Context store helpers ────────────────────────────────────────────────────

interface ArchBodyMeta {
  archmateType: string
  layer: Layer
  rfX: number
  rfY: number
  providerType?: string
  properties?: Record<string, unknown>
  codeRef?: string
}

async function storeCreate(node: Node): Promise<string | null> {
  const data = node.data as ArchimateNodeData
  const meta: ArchBodyMeta = {
    archmateType: node.type ?? 'AppComponent',
    layer: TYPE_LAYER[node.type ?? ''] ?? 'application',
    rfX: node.position.x,
    rfY: node.position.y,
    providerType: data.providerType,
    properties:   data.properties,
    codeRef:      data.codeRef,
  }
  try {
    const res = await fetch(`${CONTEXT_STORE}/nodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id:         node.id,
        type:       'Architecture',
        label:      String(data.label ?? ''),
        body:       JSON.stringify(meta),
        status:     'accepted',
        confidence: 1,
        source:     'human',
        session_id: SESSION_ID,
      }),
    })
    if (res.ok) return node.id
  } catch { /* store offline — silent */ }
  return null
}

async function storeUpdate(nodeId: string, node: Node): Promise<void> {
  const data = node.data as ArchimateNodeData
  const meta: ArchBodyMeta = {
    archmateType: node.type ?? 'AppComponent',
    layer: TYPE_LAYER[node.type ?? ''] ?? 'application',
    rfX: node.position.x,
    rfY: node.position.y,
    providerType: data.providerType,
    properties:   data.properties,
    codeRef:      data.codeRef,
  }
  try {
    await fetch(`${CONTEXT_STORE}/nodes/${nodeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: String(data.label ?? ''),
        body:  JSON.stringify(meta),
      }),
    })
  } catch { /* silent */ }
}

async function storeDelete(nodeId: string): Promise<void> {
  try {
    await fetch(`${CONTEXT_STORE}/nodes/${nodeId}`, { method: 'DELETE' })
  } catch { /* silent */ }
}

async function storeLoad(): Promise<Node[]> {
  try {
    const res = await fetch(`${CONTEXT_STORE}/nodes?type=Architecture`)
    if (!res.ok) return []
    const raw = await res.json() as { id: string; label: string; body: string }[]
    return raw.flatMap(n => {
      try {
        const meta = JSON.parse(n.body) as ArchBodyMeta
        const node: Node = {
          id:       n.id,
          type:     meta.archmateType,
          position: { x: meta.rfX ?? 100, y: meta.rfY ?? 100 },
          data: {
            label:        n.label,
            providerType: meta.providerType,
            properties:   meta.properties,
            codeRef:      meta.codeRef,
          } satisfies ArchimateNodeData,
        }
        return [node]
      } catch {
        return []
      }
    })
  } catch {
    return []
  }
}

// ─── Local persistence helpers ────────────────────────────────────────────────

function saveToLocal(nodes: Node[], edges: Edge[]) {
  try {
    localStorage.setItem(ARCH_CANVAS_KEY, JSON.stringify({ nodes, edges }))
  } catch { /* storage full */ }
}

function loadFromLocal(): { nodes: Node[]; edges: Edge[] } {
  try {
    const raw = localStorage.getItem(ARCH_CANVAS_KEY)
    if (!raw) return { nodes: [], edges: [] }
    return JSON.parse(raw) as { nodes: Node[]; edges: Edge[] }
  } catch {
    return { nodes: [], edges: [] }
  }
}

// ─── Inner canvas component (needs ReactFlowProvider context) ─────────────────

function ArchCanvas() {
  const { screenToFlowPosition, fitView } = useReactFlow()
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  const [selectedNodeId,  setSelectedNodeId]  = useState<string | null>(null)
  const [activeLayers,    setActiveLayers]    = useState<Set<Layer>>(new Set(['business', 'application', 'technology', 'motivation']))
  const [activeEdgeType,  setActiveEdgeType]  = useState('association')
  const [rightPanelOpen,  setRightPanelOpen]  = useState(true)
  const [rightTab,        setRightTab]        = useState<'prop' | 'output'>('prop')
  const [tfHcl,           setTfHcl]           = useState<string | null>(null)
  const [tfLoading,       setTfLoading]       = useState(false)

  // Debounce timer for localStorage + context store sync
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load on mount ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      // Try context store first
      const storeNodes = await storeLoad()
      if (storeNodes.length > 0) {
        setNodes(storeNodes)
        const local = loadFromLocal()
        setEdges(local.edges)
        setTimeout(() => fitView({ padding: 0.2 }), 100)
        return
      }
      // Fall back to localStorage
      const local = loadFromLocal()
      if (local.nodes.length > 0) {
        setNodes(local.nodes)
        setEdges(local.edges)
        setTimeout(() => fitView({ padding: 0.2 }), 100)
      }
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-save (debounced 800ms) ────────────────────────────────────────────
  function scheduleSave(nextNodes: Node[], nextEdges: Edge[]) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => saveToLocal(nextNodes, nextEdges), 800)
  }

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes)
    // After state update, save (we read fresh state in the next tick via setNodes)
    setNodes(prev => {
      scheduleSave(prev, edges)
      return prev
    })
  }, [onNodesChange, edges, setNodes]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    onEdgesChange(changes)
    setEdges(prev => {
      scheduleSave(nodes, prev)
      return prev
    })
  }, [onEdgesChange, nodes, setEdges]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Connect ────────────────────────────────────────────────────────────────
  const onConnect = useCallback((connection: Connection) => {
    setEdges(prev => addEdge({ ...connection, type: activeEdgeType }, prev))
  }, [activeEdgeType, setEdges])

  // ── Node selection ─────────────────────────────────────────────────────────
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id)
    setRightPanelOpen(true)
    setRightTab('prop')
  }, [setRightPanelOpen, setRightTab])

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null)
  }, [])

  // ── Drag from palette ──────────────────────────────────────────────────────
  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const archmateType = e.dataTransfer.getData('application/archimate-type')
    if (!archmateType) return

    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const id = `arch-${crypto.randomUUID().slice(0, 8)}`
    const shape = PALETTE.find(p => p.type === archmateType)

    const newNode: Node = {
      id,
      type: archmateType,
      position,
      data: { label: shape?.label ?? archmateType } satisfies ArchimateNodeData,
    }

    setNodes(prev => {
      const next = [...prev, newNode]
      saveToLocal(next, edges)
      return next
    })

    storeCreate(newNode)
    setSelectedNodeId(id)
    setRightPanelOpen(true)
    setRightTab('prop')
  }, [screenToFlowPosition, edges, setNodes, setRightPanelOpen, setRightTab])

  // ── Property editor updates ────────────────────────────────────────────────
  const handleNodeUpdate = useCallback((id: string, patch: Partial<ArchimateNodeData>) => {
    setNodes(prev => {
      const next = prev.map(n => {
        if (n.id !== id) return n
        const updated = { ...n, data: { ...n.data, ...patch } }
        storeUpdate(id, updated)
        return updated
      })
      saveToLocal(next, edges)
      return next
    })
  }, [edges, setNodes])

  // ── Node delete on Backspace/Delete ───────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') &&
          !(e.target instanceof HTMLInputElement) &&
          !(e.target instanceof HTMLTextAreaElement)) {
        if (!selectedNodeId) return
        storeDelete(selectedNodeId)
        setNodes(prev => {
          const next = prev.filter(n => n.id !== selectedNodeId)
          saveToLocal(next, edges)
          return next
        })
        setEdges(prev => {
          const next = prev.filter(ed => ed.source !== selectedNodeId && ed.target !== selectedNodeId)
          saveToLocal(nodes, next)
          return next
        })
        setSelectedNodeId(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedNodeId, edges, nodes, setNodes, setEdges])

  const selectedNode = nodes.find(n => n.id === selectedNodeId) ?? null

  // ── Terraform generation ───────────────────────────────────────────────────
  async function handleGenerateTerraform() {
    setTfLoading(true)
    setRightPanelOpen(true)
    setRightTab('output')
    try {
      const res = await fetch('http://localhost:4006/generate/terraform', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ nodes, edges }),
      })
      const data = await res.json() as { terraform?: string; error?: string }
      setTfHcl(data.terraform ?? `# Error: ${String(data.error ?? 'unknown')}`)
    } catch (err) {
      setTfHcl(`# Could not reach kortana-arch (localhost:4006)\n# ${String(err)}`)
    } finally {
      setTfLoading(false)
    }
  }

  // ── Layer toggle ───────────────────────────────────────────────────────────
  function toggleLayer(layer: Layer) {
    setActiveLayers(prev => {
      const next = new Set(prev)
      if (next.has(layer)) {
        if (next.size > 1) next.delete(layer) // keep at least one active
      } else {
        next.add(layer)
      }
      return next
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, background: '#0f172a', overflow: 'hidden' }}>

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div style={TOOLBAR_STYLE}>
        {/* Layer toggles */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {(Object.keys(LAYER_LABEL) as Layer[]).map(layer => (
            <button
              key={layer}
              onClick={() => toggleLayer(layer)}
              style={{
                background: activeLayers.has(layer) ? LAYER_COLOR[layer] : '#1e293b',
                border: `1px solid ${activeLayers.has(layer) ? LAYER_COLOR[layer] : '#334155'}`,
                color: activeLayers.has(layer) ? '#fff' : '#475569',
                fontSize: 9, fontWeight: 700,
                padding: '3px 7px', borderRadius: 2,
                cursor: 'pointer', letterSpacing: '0.07em',
                transition: 'background 0.15s',
              }}
              title={`Toggle ${LAYER_LABEL[layer]} layer`}
            >
              {layer[0].toUpperCase()}
            </button>
          ))}
        </div>

        <div style={TOOLBAR_DIVIDER} />

        {/* Mode badge (stub for Cloud mode) */}
        <div style={{
          background: '#1e293b', border: '1px solid #334155',
          color: '#94a3b8', fontSize: 9, fontWeight: 700,
          padding: '3px 8px', borderRadius: 2, letterSpacing: '0.07em',
        }}>
          ArchiMate 3
        </div>

        <div style={TOOLBAR_DIVIDER} />

        {/* Edge type selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: '#475569', fontSize: 9, letterSpacing: '0.07em' }}>EDGE</span>
          <select
            value={activeEdgeType}
            onChange={e => setActiveEdgeType(e.target.value)}
            style={{
              background: '#1e293b', border: '1px solid #334155',
              color: '#94a3b8', fontSize: 10,
              padding: '2px 6px', borderRadius: 2, cursor: 'pointer',
              outline: 'none',
            }}
          >
            {Object.entries(EDGE_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        <div style={{ flex: 1 }} />

        {/* Export / generate */}
        <button style={TOOLBAR_BTN_STYLE} title="Export as PNG (session 4)">PNG</button>
        <button
          onClick={() => { void handleGenerateTerraform() }}
          style={{ ...TOOLBAR_BTN_STYLE, color: tfLoading ? '#475569' : '#6ee7b7', borderColor: tfLoading ? '#334155' : '#2d6a2d' }}
          title="Generate Terraform HCL"
          disabled={tfLoading}
        >
          {tfLoading ? '…' : 'TERRAFORM'}
        </button>
        <button style={TOOLBAR_BTN_STYLE} title="Export ArchiMate XML (session 4)">XML</button>

        <div style={TOOLBAR_DIVIDER} />

        {/* Right panel tab toggles */}
        {(['prop', 'output'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => { setRightPanelOpen(true); setRightTab(tab) }}
            style={{
              ...TOOLBAR_BTN_STYLE,
              color:       rightPanelOpen && rightTab === tab ? '#6ee7b7' : '#475569',
              borderColor: rightPanelOpen && rightTab === tab ? '#2d6a2d' : '#334155',
            }}
            title={tab === 'prop' ? 'Property editor' : 'Output viewer'}
          >
            {tab.toUpperCase()}
          </button>
        ))}
        <button
          onClick={() => setRightPanelOpen(o => !o)}
          style={{ ...TOOLBAR_BTN_STYLE, fontSize: 11, paddingInline: 5 }}
          title="Close right panel"
        >
          ×
        </button>
      </div>

      {/* ── Workspace ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Shape palette */}
        <ShapePalette activeLayers={activeLayers} />

        {/* ReactFlow canvas */}
        <div
          style={{ flex: 1, position: 'relative' }}
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={ArchimateNodes}
            edgeTypes={ArchimateEdgeTypes}
            connectionMode={ConnectionMode.Loose}
            fitView={false}
            deleteKeyCode={null}  // we handle delete manually
            style={{ background: '#0a0f1e' }}
          >
            <Background variant={BackgroundVariant.Dots} color="#1e293b" gap={20} size={1} />
            <Controls
              style={{ background: '#1e293b', border: '1px solid #334155' }}
              showInteractive={false}
            />
          </ReactFlow>

          {/* Empty state hint */}
          {nodes.length === 0 && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none', color: '#1e293b',
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>◫</div>
              <div style={{ fontSize: 11, letterSpacing: '0.1em' }}>DRAG SHAPES FROM PALETTE</div>
            </div>
          )}
        </div>

        {/* Right panel — PROP or OUTPUT tab */}
        {rightPanelOpen && (
          <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', borderLeft: '1px solid #1e293b', overflow: 'hidden' }}>
            {rightTab === 'prop'
              ? <PropertyEditor node={selectedNode} onUpdate={handleNodeUpdate} onClose={() => setRightPanelOpen(false)} />
              : <OutputViewer hcl={tfHcl} loading={tfLoading} />
            }
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Shape palette ────────────────────────────────────────────────────────────

function ShapePalette({ activeLayers }: { activeLayers: Set<Layer> }) {
  function onDragStart(e: DragEvent<HTMLDivElement>, archmateType: string) {
    e.dataTransfer.setData('application/archimate-type', archmateType)
    e.dataTransfer.effectAllowed = 'move'
  }

  const layerGroups = (Object.keys(LAYER_LABEL) as Layer[]).filter(l => activeLayers.has(l))

  return (
    <div style={{
      width: 120,
      flexShrink: 0,
      background: '#0f172a',
      borderRight: '1px solid #1e293b',
      overflowY: 'auto',
      padding: '8px 0',
    }}>
      {layerGroups.map(layer => {
        const shapes = PALETTE.filter(p => p.layer === layer)
        const color = LAYER_COLOR[layer]
        return (
          <div key={layer} style={{ marginBottom: 8 }}>
            {/* Layer header */}
            <div style={{
              padding: '3px 10px',
              fontSize: 8, fontWeight: 700, letterSpacing: '0.1em',
              color, borderBottom: `1px solid ${color}22`,
              marginBottom: 4,
            }}>
              {LAYER_LABEL[layer]}
            </div>
            {/* Shape items */}
            {shapes.map(shape => (
              <div
                key={shape.type}
                draggable
                onDragStart={e => onDragStart(e, shape.type)}
                title={`${shape.type} — drag to canvas`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 10px',
                  cursor: 'grab',
                  userSelect: 'none',
                  borderRadius: 2,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#1e293b')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{
                  background: color,
                  color: '#fff',
                  fontSize: 8, fontWeight: 700,
                  padding: '1px 3px', borderRadius: 1,
                  letterSpacing: '0.05em',
                  fontFamily: 'var(--font-mono, monospace)',
                  flexShrink: 0,
                }}>
                  {shape.abbr}
                </span>
                <span style={{ color: '#64748b', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {shape.label}
                </span>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

// ─── Root export (provides ReactFlow context) ─────────────────────────────────

export default function ArchitectureDashboard() {
  return (
    <ReactFlowProvider>
      <ArchCanvas />
    </ReactFlowProvider>
  )
}

// ─── Shared toolbar styles ────────────────────────────────────────────────────

const TOOLBAR_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 12px',
  background: '#0f172a',
  borderBottom: '1px solid #1e293b',
  flexShrink: 0,
}

const TOOLBAR_DIVIDER: React.CSSProperties = {
  width: 1,
  height: 16,
  background: '#1e293b',
  flexShrink: 0,
}

const TOOLBAR_BTN_STYLE: React.CSSProperties = {
  background: '#1e293b',
  border: '1px solid #334155',
  color: '#475569',
  fontSize: 9,
  fontWeight: 700,
  padding: '3px 7px',
  borderRadius: 2,
  cursor: 'pointer',
  letterSpacing: '0.07em',
  fontFamily: 'var(--font-mono, monospace)',
}
