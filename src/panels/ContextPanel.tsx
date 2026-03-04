import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import type { GraphNode, GraphEdge } from '../types'

type View = 'list' | 'graph'
type ContextStatus = 'live' | 'stale' | 'offline'

const NODE_COLORS: Record<string, string> = {
  Goal:           'var(--accent-green)',
  Intent:         'var(--accent-green)',
  Requirement:    'var(--accent-blue)',
  Decision:       'var(--accent-amber)',
  Component:      '#9060ff',
  Question:       'var(--accent-red)',
  Implementation: '#6868a0',
  Constraint:     'var(--accent-red)',
  Risk:           'var(--accent-amber)',
}

const POLL_MS = 30_000
const HEALTH_MS = 10_000
const BASE_URL = 'http://localhost:4000'

function fmtTime(d: Date): string {
  return d.toTimeString().slice(0, 8)
}

// ─── ListView ────────────────────────────────────────────────────────────────

function ListView({
  nodes,
  selected,
  onSelect,
}: {
  nodes: GraphNode[]
  selected: GraphNode | null
  onSelect: (n: GraphNode) => void
}) {
  return (
    <div className="ctx-list">
      <table className="ctx-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Type</th>
            <th>Label</th>
            <th>Status</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {nodes.map((n) => (
            <tr
              key={n.id}
              className={`ctx-table__row${selected?.id === n.id ? ' ctx-table__row--selected' : ''}`}
              onClick={() => onSelect(n)}
            >
              <td className="ctx-table__id">{n.id.slice(0, 8)}</td>
              <td>
                <span
                  className="ctx-table__type"
                  style={{ color: NODE_COLORS[n.type] ?? 'var(--text-dim)' }}
                >
                  {n.type}
                </span>
              </td>
              <td className="ctx-table__label">{n.label}</td>
              <td>
                <span className={`ctx-badge ctx-badge--${n.status}`}>{n.status}</span>
              </td>
              <td className="ctx-table__time">
                {new Date(n.updated_at).toLocaleTimeString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── GraphView ───────────────────────────────────────────────────────────────

type SimNode = d3.SimulationNodeDatum & GraphNode
type SimLink = d3.SimulationLinkDatum<SimNode> & { edgeType: string }

function GraphView({
  nodes,
  edges,
  onSelect,
}: {
  nodes: GraphNode[]
  edges: GraphEdge[]
  onSelect: (n: GraphNode) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  useEffect(() => {
    const container = containerRef.current
    const svgEl = svgRef.current
    if (!container || !svgEl || nodes.length === 0) return

    const { width, height } = container.getBoundingClientRect()
    const w = width || 600
    const h = height || 400

    const svg = d3.select(svgEl)
    svg.selectAll('*').remove()
    svg.attr('viewBox', `0 0 ${w} ${h}`)

    const simNodes: SimNode[] = nodes.map((n) => ({ ...n }))
    const nodeById = new Map(simNodes.map((n) => [n.id, n]))

    const simLinks: SimLink[] = edges
      .filter((e) => nodeById.has(e.from_id) && nodeById.has(e.to_id))
      .map((e) => ({ source: e.from_id, target: e.to_id, edgeType: e.type }))

    const simulation = d3
      .forceSimulation<SimNode>(simNodes)
      .force(
        'link',
        d3.forceLink<SimNode, SimLink>(simLinks).id((d) => d.id).distance(90),
      )
      .force('charge', d3.forceManyBody<SimNode>().strength(-200))
      .force('center', d3.forceCenter(w / 2, h / 2))
      .force('collision', d3.forceCollide<SimNode>(22))

    const linkSel = svg
      .append('g')
      .selectAll<SVGLineElement, SimLink>('line')
      .data(simLinks)
      .join('line')
      .attr('stroke', '#1e1e3a')
      .attr('stroke-width', 1)

    const nodeSel = svg
      .append('g')
      .selectAll<SVGGElement, SimNode>('g')
      .data(simNodes)
      .join('g')
      .style('cursor', 'pointer')
      .on('click', (_e, d) => onSelectRef.current(d as GraphNode))
      .call(
        d3
          .drag<SVGGElement, SimNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart()
            d.fx = d.x
            d.fy = d.y
          })
          .on('drag', (event, d) => {
            d.fx = event.x
            d.fy = event.y
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0)
            d.fx = null
            d.fy = null
          }),
      )

    nodeSel
      .append('circle')
      .attr('r', 7)
      .attr('fill', (d) => NODE_COLORS[d.type] ?? '#6060a0')
      .attr('fill-opacity', 0.85)
      .attr('stroke', '#16162a')
      .attr('stroke-width', 1.5)

    nodeSel
      .append('text')
      .attr('dy', 17)
      .attr('text-anchor', 'middle')
      .attr('font-size', 8)
      .attr('fill', '#6060a0')
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('pointer-events', 'none')
      .text((d) => (d.label.length > 20 ? d.label.slice(0, 18) + '…' : d.label))

    simulation.on('tick', () => {
      linkSel
        .attr('x1', (d) => (d.source as SimNode).x ?? 0)
        .attr('y1', (d) => (d.source as SimNode).y ?? 0)
        .attr('x2', (d) => (d.target as SimNode).x ?? 0)
        .attr('y2', (d) => (d.target as SimNode).y ?? 0)
      nodeSel.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    return () => {
      simulation.stop()
    }
  }, [nodes, edges])

  return (
    <div ref={containerRef} className="ctx-graph-wrap">
      <svg ref={svgRef} className="ctx-graph" />
    </div>
  )
}

// ─── NodeDrawer ──────────────────────────────────────────────────────────────

function NodeDrawer({ node, onClose }: { node: GraphNode; onClose: () => void }) {
  return (
    <div className="ctx-drawer__inner">
      <div className="ctx-drawer__header">
        <span
          className="ctx-drawer__type"
          style={{ color: NODE_COLORS[node.type] ?? 'var(--text-dim)' }}
        >
          {node.type}
        </span>
        <button className="ctx-drawer__close" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="ctx-drawer__body">
        <p className="ctx-drawer__label">{node.label}</p>
        <dl className="ctx-drawer__meta">
          <dt>ID</dt>
          <dd>{node.id}</dd>
          <dt>Status</dt>
          <dd>
            <span className={`ctx-badge ctx-badge--${node.status}`}>{node.status}</span>
          </dd>
          {node.confidence !== undefined && (
            <>
              <dt>Confidence</dt>
              <dd>{node.confidence}</dd>
            </>
          )}
          {node.source && (
            <>
              <dt>Source</dt>
              <dd>{node.source}</dd>
            </>
          )}
          {node.session_id && (
            <>
              <dt>Session</dt>
              <dd>{node.session_id}</dd>
            </>
          )}
          <dt>Created</dt>
          <dd>{new Date(node.created_at).toLocaleString()}</dd>
          <dt>Updated</dt>
          <dd>{new Date(node.updated_at).toLocaleString()}</dd>
        </dl>
      </div>
    </div>
  )
}

// ─── StatusChip ──────────────────────────────────────────────────────────────

function StatusChip({ status, nodeCount, fetchedAt }: {
  status: ContextStatus
  nodeCount: number
  fetchedAt: Date | null
}) {
  if (status === 'live') {
    return (
      <span className="ctx-status ctx-status--live">
        ● CONTEXT LIVE
        {fetchedAt && ` · ${nodeCount} nodes · ${fmtTime(fetchedAt)}`}
      </span>
    )
  }
  if (status === 'stale') {
    return (
      <span className="ctx-status ctx-status--stale">
        ● CONTEXT STALE
        {nodeCount > 0 && ` · ${nodeCount} nodes`}
      </span>
    )
  }
  return <span className="ctx-status ctx-status--offline">● CONTEXT OFFLINE</span>
}

// ─── ContextPanel ────────────────────────────────────────────────────────────

export default function ContextPanel() {
  const [view, setView] = useState<View>('list')
  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [edges, setEdges] = useState<GraphEdge[]>([])
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null)
  const [selected, setSelected] = useState<GraphNode | null>(null)
  const [loading, setLoading] = useState(true)
  const [ctxStatus, setCtxStatus] = useState<ContextStatus>('offline')
  const hasData = useRef(false)

  // Health poller — every 10s
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch(`${BASE_URL}/health`)
        if (res.ok) {
          setCtxStatus('live')
        } else {
          setCtxStatus(hasData.current ? 'stale' : 'offline')
        }
      } catch {
        setCtxStatus(hasData.current ? 'stale' : 'offline')
      }
    }

    checkHealth()
    const id = setInterval(checkHealth, HEALTH_MS)
    return () => clearInterval(id)
  }, [])

  // Data poller — every 30s
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [nodesRes, edgesRes] = await Promise.all([
          fetch(`${BASE_URL}/nodes`),
          fetch(`${BASE_URL}/edges`),
        ])
        if (!nodesRes.ok || !edgesRes.ok) {
          throw new Error(`HTTP ${nodesRes.status}/${edgesRes.status}`)
        }
        const nodesJson = await nodesRes.json()
        const edgesJson = await edgesRes.json()
        setNodes(Array.isArray(nodesJson) ? nodesJson : (nodesJson.nodes ?? []))
        setEdges(Array.isArray(edgesJson) ? edgesJson : (edgesJson.edges ?? []))
        setFetchedAt(new Date())
        hasData.current = true
      } catch {
        // health poller drives status; data errors don't override
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    const id = setInterval(fetchData, POLL_MS)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="ctx-panel">
      {/* Sub-header */}
      <div className="ctx-panel__header">
        <div className="ctx-panel__views">
          <button
            className={`ctx-panel__view-btn${view === 'list' ? ' ctx-panel__view-btn--active' : ''}`}
            onClick={() => setView('list')}
          >
            LIST
          </button>
          <button
            className={`ctx-panel__view-btn${view === 'graph' ? ' ctx-panel__view-btn--active' : ''}`}
            onClick={() => setView('graph')}
          >
            GRAPH
          </button>
        </div>
        <StatusChip
          status={loading && !fetchedAt ? 'offline' : ctxStatus}
          nodeCount={nodes.length}
          fetchedAt={fetchedAt}
        />
      </div>

      {/* Main area */}
      <div className="ctx-panel__body">
        {view === 'list' ? (
          <ListView nodes={nodes} selected={selected} onSelect={setSelected} />
        ) : (
          <GraphView nodes={nodes} edges={edges} onSelect={setSelected} />
        )}

        {/* Node detail drawer — slides in from right */}
        <div className={`ctx-drawer${selected ? ' ctx-drawer--open' : ''}`}>
          {selected && (
            <NodeDrawer node={selected} onClose={() => setSelected(null)} />
          )}
        </div>
      </div>
    </div>
  )
}
