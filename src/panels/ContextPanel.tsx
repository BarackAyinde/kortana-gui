import { useCallback, useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import type { GraphNode, GraphEdge } from '../types'
import { useClock } from '../hooks/useClock'

type View = 'table' | 'graph'
type GraphMode = 'graph' | 'folders'
type ContextStatus = 'live' | 'stale' | 'offline'
type SimNode = d3.SimulationNodeDatum & GraphNode
type SimLink = d3.SimulationLinkDatum<SimNode> & { edgeType: string; edgeId: string }

// ─── Spec colours (lowercase type keys) ───────────────────────────────────────
const NODE_COLORS: Record<string, string> = {
  component:      '#00aaff',
  decision:       '#ff8800',
  goal:           '#00ff88',
  implementation: '#aa00ff',
  risk:           '#ff3333',
  session:        '#888888',
  scope:          '#ffff00',
}
function nodeColor(type: string): string {
  return NODE_COLORS[type.toLowerCase()] ?? '#cccccc'
}

const POLL_MS  = 30_000
const HEALTH_MS = 10_000
const BASE_URL  = 'http://localhost:4000'
const WS_URL    = 'ws://localhost:4000'

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// ─── TableView ────────────────────────────────────────────────────────────────

const COL_KEYS = ['id', 'type', 'label', 'status', 'updated'] as const
type ColKey = typeof COL_KEYS[number]
const COL_LABELS: Record<ColKey, string> = {
  id: 'ID', type: 'TYPE', label: 'LABEL', status: 'STATUS', updated: 'UPDATED',
}
const DEFAULT_WIDTHS: Record<ColKey, number> = {
  id: 150, type: 100, label: 220, status: 90, updated: 180,
}
type SortDir = 'asc' | 'desc'

function sortNodes(nodes: GraphNode[], col: ColKey, dir: SortDir): GraphNode[] {
  const sorted = [...nodes].sort((a, b) => {
    let av: string, bv: string
    if (col === 'updated') { av = a.updated_at;  bv = b.updated_at }
    else if (col === 'id')  { av = a.id;          bv = b.id }
    else if (col === 'type'){ av = a.type;         bv = b.type }
    else if (col === 'status'){ av = a.status;     bv = b.status }
    else                    { av = a.label;        bv = b.label }
    return av < bv ? -1 : av > bv ? 1 : 0
  })
  return dir === 'desc' ? sorted.reverse() : sorted
}

function ListView({
  nodes,
  selected,
  onSelect,
}: {
  nodes: GraphNode[]
  selected: GraphNode | null
  onSelect: (n: GraphNode) => void
}) {
  const [widths, setWidths] = useState<Record<ColKey, number>>(DEFAULT_WIDTHS)
  const [sortCol, setSortCol] = useState<ColKey>('updated')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const onResizeStart = useCallback((col: ColKey) => (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const startX = e.clientX
    const startW = widths[col]
    const onMove = (ev: MouseEvent) => {
      const newW = Math.max(40, startW + (ev.clientX - startX))
      setWidths((prev) => ({ ...prev, [col]: newW }))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [widths])

  const onHeaderClick = useCallback((col: ColKey) => {
    setSortCol(col)
    setSortDir((prev) => (sortCol === col && prev === 'asc' ? 'desc' : 'asc'))
  }, [sortCol])

  const sorted = sortNodes(nodes, sortCol, sortDir)

  return (
    <div className="ctx-list">
      <table className="ctx-table" style={{ tableLayout: 'fixed' }}>
        <colgroup>
          {COL_KEYS.map((col) => (
            <col key={col} style={{ width: widths[col] }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {COL_KEYS.map((col, i) => (
              <th
                key={col}
                style={{ position: 'relative', cursor: 'pointer' }}
                onClick={() => onHeaderClick(col)}
              >
                {COL_LABELS[col]}
                {sortCol === col && (
                  <span className="ctx-sort-arrow">{sortDir === 'asc' ? ' ▴' : ' ▾'}</span>
                )}
                {i < COL_KEYS.length - 1 && (
                  <div className="ctx-col-resize" onMouseDown={onResizeStart(col)} />
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((n) => (
            <tr
              key={n.id}
              className={`ctx-table__row${selected?.id === n.id ? ' ctx-table__row--selected' : ''}`}
              onClick={() => onSelect(n)}
            >
              <td className="ctx-table__id">{n.id}</td>
              <td>
                <span className="ctx-table__type" style={{ color: nodeColor(n.type) }}>
                  {n.type}
                </span>
              </td>
              <td className="ctx-table__label">{n.label}</td>
              <td>
                <span className={`ctx-badge ctx-badge--${n.status}`}>{n.status}</span>
              </td>
              <td className="ctx-table__time">{new Date(n.updated_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── NodeDrawer ───────────────────────────────────────────────────────────────

function NodeDrawer({ node, onClose }: { node: GraphNode; onClose: () => void }) {
  return (
    <div className="ctx-drawer__inner">
      <div className="ctx-drawer__header">
        <span className="ctx-drawer__type" style={{ color: nodeColor(node.type) }}>
          {node.type}
        </span>
        <button className="ctx-drawer__close" onClick={onClose}>×</button>
      </div>
      <div className="ctx-drawer__body">
        <p className="ctx-drawer__label">{node.label}</p>
        <dl className="ctx-drawer__meta">
          <dt>ID</dt><dd>{node.id}</dd>
          <dt>Status</dt>
          <dd><span className={`ctx-badge ctx-badge--${node.status}`}>{node.status}</span></dd>
          {node.confidence !== undefined && (<><dt>Confidence</dt><dd>{node.confidence}</dd></>)}
          {node.source && (<><dt>Source</dt><dd>{node.source}</dd></>)}
          {node.session_id && (<><dt>Session</dt><dd>{node.session_id}</dd></>)}
          <dt>Created</dt><dd>{new Date(node.created_at).toLocaleString()}</dd>
          <dt>Updated</dt><dd>{new Date(node.updated_at).toLocaleString()}</dd>
        </dl>
      </div>
    </div>
  )
}

// ─── StatusChip ───────────────────────────────────────────────────────────────

function StatusChip({ status, nodeCount }: { status: ContextStatus; nodeCount: number }) {
  const now = useClock()
  if (status === 'live') {
    return (
      <span className="ctx-status ctx-status--live">
        ● CONTEXT LIVE · {nodeCount} nodes · {fmtTime(now)}
      </span>
    )
  }
  if (status === 'stale') {
    return (
      <span className="ctx-status ctx-status--stale">
        ● CONTEXT STALE{nodeCount > 0 ? ` · ${nodeCount} nodes` : ''}
      </span>
    )
  }
  return <span className="ctx-status ctx-status--offline">● CONTEXT OFFLINE</span>
}

// ─── GraphView ────────────────────────────────────────────────────────────────

function GraphView({
  nodes,
  edges,
  graphMode,
  onSelect,
  onExpand,
}: {
  nodes: GraphNode[]
  edges: GraphEdge[]
  graphMode: GraphMode
  onSelect: (n: GraphNode) => void
  onExpand: (id: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef       = useRef<SVGSVGElement>(null)
  const mmRef        = useRef<SVGSVGElement>(null)
  const onSelectRef  = useRef(onSelect)
  const onExpandRef  = useRef(onExpand)
  const zoomRef      = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const positionsRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  const transformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity)
  const mmMetaRef    = useRef({ scale: 1, offsetX: 0, offsetY: 0 })

  onSelectRef.current = onSelect
  onExpandRef.current = onExpand

  // ── Fit-all ────────────────────────────────────────────────────────────────
  const fitAll = useCallback(() => {
    const svgEl = svgRef.current
    const zoom  = zoomRef.current
    const cont  = containerRef.current
    if (!svgEl || !zoom || !cont) return
    const { width: w, height: h } = cont.getBoundingClientRect()
    const positions = [...positionsRef.current.values()]
    if (positions.length === 0) return
    const xs   = positions.map((p) => p.x)
    const ys   = positions.map((p) => p.y)
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minY = Math.min(...ys), maxY = Math.max(...ys)
    const pad  = 60
    const spanX = maxX - minX + 2 * pad
    const spanY = maxY - minY + 2 * pad
    const k  = Math.min(w / (spanX || 1), h / (spanY || 1), 4)
    const tx = (w - k * (minX + maxX)) / 2
    const ty = (h - k * (minY + maxY)) / 2
    d3.select(svgEl)
      .transition()
      .duration(500)
      .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(k))
  }, [])

  // ── Main simulation effect ─────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current
    const svgEl     = svgRef.current
    const mmEl      = mmRef.current
    if (!container || !svgEl || nodes.length === 0) return

    const { width: cw, height: ch } = container.getBoundingClientRect()
    const w = cw || 600
    const h = ch || 400

    // ── SVG scaffold ──────────────────────────────────────────────────────────
    const svg = d3.select(svgEl)
    svg.selectAll('*').remove()
    svg.attr('viewBox', `0 0 ${w} ${h}`)

    const g = svg.append('g').attr('class', 'graph-root')

    // ── Sim nodes: seed positions from cache ──────────────────────────────────
    const simNodes: SimNode[] = nodes.map((n) => {
      const saved = positionsRef.current.get(n.id)
      return {
        ...n,
        x: saved?.x ?? (w / 2 + (Math.random() - 0.5) * 200),
        y: saved?.y ?? (h / 2 + (Math.random() - 0.5) * 200),
      }
    })
    const nodeById  = new Map(simNodes.map((n) => [n.id, n]))
    const simLinks: SimLink[] = edges
      .filter((e) => nodeById.has(e.from_id) && nodeById.has(e.to_id))
      .map((e) => ({ source: e.from_id, target: e.to_id, edgeType: e.type, edgeId: e.id }))

    // ── Folder mode type centroids ────────────────────────────────────────────
    const types = [...new Set(simNodes.map((n) => n.type))]
    const typeCentroids = new Map<string, { x: number; y: number }>()
    const clusterR = Math.min(w, h) * 0.28
    types.forEach((t, i) => {
      const angle = (2 * Math.PI * i) / types.length - Math.PI / 2
      typeCentroids.set(t, {
        x: w / 2 + clusterR * Math.cos(angle),
        y: h / 2 + clusterR * Math.sin(angle),
      })
    })

    // ── Forces ────────────────────────────────────────────────────────────────
    const simulation = d3.forceSimulation<SimNode>(simNodes)
      .force('link',      d3.forceLink<SimNode, SimLink>(simLinks).id((d) => d.id).distance(120))
      .force('charge',    d3.forceManyBody<SimNode>().strength(-200))
      .force('center',    d3.forceCenter(w / 2, h / 2))
      .force('collision', d3.forceCollide<SimNode>(22))

    if (graphMode === 'folders') {
      simulation
        .force('clusterX', d3.forceX<SimNode>((d) => typeCentroids.get(d.type)?.x ?? w / 2).strength(0.15))
        .force('clusterY', d3.forceY<SimNode>((d) => typeCentroids.get(d.type)?.y ?? h / 2).strength(0.15))
    }

    // ── Group boundary layer (folders mode only) ──────────────────────────────
    const groupsG = g.append('g').attr('class', 'graph-groups')

    // ── Links ─────────────────────────────────────────────────────────────────
    const linkSel = g.append('g')
      .selectAll<SVGLineElement, SimLink>('line')
      .data(simLinks)
      .join('line')
      .attr('stroke', '#444444')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.4)
      .style('cursor', 'default')

    linkSel.append<SVGTitleElement>('title').text((d) => d.edgeType)

    linkSel
      .on('mouseover', function(_, d) {
        const src = d.source as SimNode
        d3.select(this).attr('stroke-opacity', 1).attr('stroke', nodeColor(src.type))
      })
      .on('mouseout', function() {
        d3.select(this).attr('stroke-opacity', 0.4).attr('stroke', '#444444')
      })

    // ── Nodes ─────────────────────────────────────────────────────────────────
    const nodeSel = g.append('g')
      .selectAll<SVGGElement, SimNode>('g')
      .data(simNodes)
      .join('g')
      .style('cursor', 'pointer')

    nodeSel
      .append('circle')
      .attr('r', (d) => d.status === 'accepted' ? 12 : 8)
      .attr('fill', (d) => nodeColor(d.type))
      .attr('fill-opacity', 0.85)
      .attr('stroke', '#0d0d0d')
      .attr('stroke-width', 1.5)

    nodeSel
      .append('text')
      .attr('dy', (d) => (d.status === 'accepted' ? 12 : 8) + 10)
      .attr('text-anchor', 'middle')
      .attr('font-size', 11)
      .attr('fill', '#aaaaaa')
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('pointer-events', 'none')
      .text((d) => d.label.length > 20 ? d.label.slice(0, 18) + '…' : d.label)

    nodeSel
      .on('mouseover', function(_, d) {
        d3.select(this).select<SVGTextElement>('text').text(d.label)
        d3.select(this).select<SVGCircleElement>('circle')
          .attr('stroke', nodeColor(d.type))
          .attr('stroke-width', 3)
          .attr('stroke-opacity', 0.8)
      })
      .on('mouseout', function(_, d) {
        d3.select(this).select<SVGTextElement>('text')
          .text(d.label.length > 20 ? d.label.slice(0, 18) + '…' : d.label)
        d3.select(this).select<SVGCircleElement>('circle')
          .attr('stroke', '#0d0d0d')
          .attr('stroke-width', 1.5)
          .attr('stroke-opacity', 1)
      })
      .on('click', (event: MouseEvent, d) => {
        event.stopPropagation()
        onSelectRef.current(d as GraphNode)
        onExpandRef.current(d.id)
      })
      .call(
        d3.drag<SVGGElement, SimNode>()
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

    // ── Helpers ───────────────────────────────────────────────────────────────
    function updateGroups() {
      if (graphMode !== 'folders') {
        groupsG.selectAll('*').remove()
        return
      }
      interface GroupBB { minX: number; minY: number; maxX: number; maxY: number }
      const groups = new Map<string, GroupBB>()
      for (const n of simNodes) {
        const nx = n.x ?? 0, ny = n.y ?? 0
        const existing = groups.get(n.type)
        if (!existing) {
          groups.set(n.type, { minX: nx, minY: ny, maxX: nx, maxY: ny })
        } else {
          if (nx < existing.minX) existing.minX = nx
          if (ny < existing.minY) existing.minY = ny
          if (nx > existing.maxX) existing.maxX = nx
          if (ny > existing.maxY) existing.maxY = ny
        }
      }
      const PAD = 28
      const groupData = [...groups.entries()].map(([type, bb]) => ({ type, bb }))

      groupsG
        .selectAll<SVGGElement, { type: string; bb: GroupBB }>('g.group-cluster')
        .data(groupData, (d) => d.type)
        .join(
          (enter) => {
            const ge = enter.append('g').attr('class', 'group-cluster')
            ge.append('rect')
              .attr('rx', 10).attr('ry', 10)
              .attr('fill', (d) => nodeColor(d.type))
              .attr('fill-opacity', 0.05)
              .attr('stroke', (d) => nodeColor(d.type))
              .attr('stroke-opacity', 0.18)
              .attr('stroke-width', 1)
            ge.append('text')
              .attr('font-size', 10)
              .attr('font-family', 'JetBrains Mono, monospace')
              .attr('font-weight', 600)
              .attr('letter-spacing', '0.06em')
              .attr('fill', (d) => nodeColor(d.type))
              .attr('opacity', 0.5)
              .text((d) => d.type.toUpperCase())
            return ge
          },
        )
        .each(function(d) {
          const { minX, minY, maxX, maxY } = d.bb
          d3.select(this).select<SVGRectElement>('rect')
            .attr('x', minX - PAD)
            .attr('y', minY - PAD)
            .attr('width', maxX - minX + 2 * PAD)
            .attr('height', maxY - minY + 2 * PAD)
          d3.select(this).select<SVGTextElement>('text')
            .attr('x', minX - PAD + 8)
            .attr('y', minY - PAD - 5)
        })
    }

    function updateMinimap() {
      if (!mmEl) return
      const MM_W = 120, MM_H = 80
      const mm = d3.select(mmEl)
      const xs = simNodes.map((n) => n.x ?? 0)
      const ys = simNodes.map((n) => n.y ?? 0)
      if (xs.length === 0) return
      const minX = Math.min(...xs) - 20, maxX = Math.max(...xs) + 20
      const minY = Math.min(...ys) - 20, maxY = Math.max(...ys) + 20
      const spanX = maxX - minX || 1, spanY = maxY - minY || 1
      const scale = Math.min(MM_W / spanX, MM_H / spanY) * 0.9
      const offsetX = (MM_W - spanX * scale) / 2 - minX * scale
      const offsetY = (MM_H - spanY * scale) / 2 - minY * scale
      mmMetaRef.current = { scale, offsetX, offsetY }

      mm.selectAll<SVGCircleElement, SimNode>('circle.mm-dot')
        .data(simNodes, (d) => d.id)
        .join('circle')
        .attr('class', 'mm-dot')
        .attr('r', 2)
        .attr('fill', (d) => nodeColor(d.type))
        .attr('cx', (d) => (d.x ?? 0) * scale + offsetX)
        .attr('cy', (d) => (d.y ?? 0) * scale + offsetY)

      const t = transformRef.current
      const vx = (-t.x / t.k) * scale + offsetX
      const vy = (-t.y / t.k) * scale + offsetY
      const vw = (w / t.k) * scale
      const vh = (h / t.k) * scale
      mm.selectAll<SVGRectElement, null>('rect.mm-viewport')
        .data([null])
        .join('rect')
        .attr('class', 'mm-viewport')
        .attr('x', vx)
        .attr('y', vy)
        .attr('width', vw)
        .attr('height', vh)
        .attr('fill', 'none')
        .attr('stroke', '#00ff88')
        .attr('stroke-width', 0.75)
        .attr('stroke-opacity', 0.7)
    }

    // ── Tick ──────────────────────────────────────────────────────────────────
    let ticks = 0
    simulation.on('tick', () => {
      ticks++
      if (ticks >= 300) {
        simulation.alphaTarget(0).stop()
      }

      linkSel
        .attr('x1', (d) => (d.source as SimNode).x ?? 0)
        .attr('y1', (d) => (d.source as SimNode).y ?? 0)
        .attr('x2', (d) => (d.target as SimNode).x ?? 0)
        .attr('y2', (d) => (d.target as SimNode).y ?? 0)

      nodeSel.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)

      // Save positions
      for (const n of simNodes) {
        positionsRef.current.set(n.id, { x: n.x ?? 0, y: n.y ?? 0 })
      }

      updateGroups()
      if (ticks % 5 === 0) updateMinimap()
    })

    // ── Zoom ──────────────────────────────────────────────────────────────────
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        g.attr('transform', event.transform.toString())
        transformRef.current = event.transform
        updateMinimap()
      })

    svg.call(zoom)
    zoomRef.current = zoom

    // Apply saved transform
    svg.call(zoom.transform, transformRef.current)

    // Double-click on empty canvas → fit all
    svg.on('dblclick.zoom', null) // remove default dblclick zoom
    svg.on('dblclick', () => fitAll())

    // ── Minimap: click to jump ─────────────────────────────────────────────
    if (mmEl) {
      d3.select(mmEl).on('click', (event: MouseEvent) => {
        const [mx, my] = d3.pointer(event, mmEl)
        const { scale: ms, offsetX: ox, offsetY: oy } = mmMetaRef.current
        const gx = (mx - ox) / ms
        const gy = (my - oy) / ms
        const t  = transformRef.current
        const z  = zoomRef.current
        if (!z) return
        d3.select(svgEl).transition().duration(300)
          .call(z.transform, d3.zoomIdentity.translate(w / 2 - gx * t.k, h / 2 - gy * t.k).scale(t.k))
      })
    }

    return () => { simulation.stop() }
  }, [nodes, edges, graphMode, fitAll])

  return (
    <div ref={containerRef} className="ctx-graph-wrap">
      <svg ref={svgRef} className="ctx-graph" />
      <svg
        ref={mmRef}
        className="ctx-minimap"
        width={120}
        height={80}
        style={{
          position: 'absolute',
          bottom: 8,
          right: 8,
          background: 'rgba(0,0,0,0.7)',
          border: '1px solid #333',
          borderRadius: 4,
          cursor: 'pointer',
        }}
      />
    </div>
  )
}

// ─── ContextPanel ─────────────────────────────────────────────────────────────

export default function ContextPanel() {
  const [view, setView]         = useState<View>('table')
  const [graphMode, setGraphMode] = useState<GraphMode>('graph')
  const [nodes, setNodes]       = useState<GraphNode[]>([])
  const [edges, setEdges]       = useState<GraphEdge[]>([])
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null)
  const [selected, setSelected] = useState<GraphNode | null>(null)
  const [loading, setLoading]   = useState(true)
  const [ctxStatus, setCtxStatus] = useState<ContextStatus>('offline')
  const hasData = useRef(false)
  const prevNodesRef = useRef('')
  const prevEdgesRef = useRef('')

  // ── Health poller ──────────────────────────────────────────────────────────
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${BASE_URL}/health`)
        setCtxStatus(res.ok ? 'live' : (hasData.current ? 'stale' : 'offline'))
      } catch {
        setCtxStatus(hasData.current ? 'stale' : 'offline')
      }
    }
    check()
    const id = setInterval(check, HEALTH_MS)
    return () => clearInterval(id)
  }, [])

  // ── Initial data + 30s poll ────────────────────────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [nr, er] = await Promise.all([
          fetch(`${BASE_URL}/nodes`),
          fetch(`${BASE_URL}/edges`),
        ])
        if (!nr.ok || !er.ok) throw new Error(`HTTP ${nr.status}/${er.status}`)
        const nj = await nr.json()
        const ej = await er.json()
        const newNodes: GraphNode[] = Array.isArray(nj) ? nj : (nj.nodes ?? [])
        const newEdges: GraphEdge[] = Array.isArray(ej) ? ej : (ej.edges ?? [])
        const ns = JSON.stringify(newNodes), es = JSON.stringify(newEdges)
        if (ns !== prevNodesRef.current || es !== prevEdgesRef.current) {
          setNodes(newNodes)
          setEdges(newEdges)
          prevNodesRef.current = ns
          prevEdgesRef.current = es
        }
        setFetchedAt(new Date())
        hasData.current = true
      } catch { /* health poller drives status */ }
      finally { setLoading(false) }
    }
    fetchData()
    const id = setInterval(fetchData, POLL_MS)
    return () => clearInterval(id)
  }, [])

  // ── WebSocket — live incremental updates ───────────────────────────────────
  useEffect(() => {
    const ws = new WebSocket(WS_URL)
    ws.onmessage = (e: MessageEvent<string>) => {
      try {
        const msg = JSON.parse(e.data) as { event: string; data: Record<string, unknown> }
        if (msg.event === 'node:created') {
          const node = msg.data as unknown as GraphNode
          setNodes((prev) => prev.some((n) => n.id === node.id) ? prev : [...prev, node])
        } else if (msg.event === 'node:updated') {
          const node = msg.data as unknown as GraphNode
          setNodes((prev) => prev.map((n) => n.id === node.id ? node : n))
        } else if (msg.event === 'node:deleted') {
          const { id } = msg.data as { id: string }
          setNodes((prev) => prev.filter((n) => n.id !== id))
          setEdges((prev) => prev.filter((edge) => edge.from_id !== id && edge.to_id !== id))
        } else if (msg.event === 'edge:created') {
          const edge = msg.data as unknown as GraphEdge
          setEdges((prev) => prev.some((ex) => ex.id === edge.id) ? prev : [...prev, edge])
        }
      } catch { /* ignore malformed messages */ }
    }
    return () => ws.close()
  }, [])

  // ── Expand neighbours on node click ────────────────────────────────────────
  const onExpand = useCallback(async (nodeId: string) => {
    try {
      const res = await fetch(`${BASE_URL}/nodes/${nodeId}/neighbours`)
      if (!res.ok) return
      const data = await res.json() as {
        neighbours: {
          outgoing: Array<{ edge: GraphEdge; node: GraphNode }>
          incoming: Array<{ edge: GraphEdge; node: GraphNode }>
        }
      }
      const { outgoing, incoming } = data.neighbours
      const all = [...outgoing, ...incoming]
      setNodes((prev) => {
        const ids = new Set(prev.map((n) => n.id))
        const newN = all.map((e) => e.node).filter((n) => !ids.has(n.id))
        return newN.length > 0 ? [...prev, ...newN] : prev
      })
      setEdges((prev) => {
        const ids = new Set(prev.map((e) => e.id))
        const newE = all.map((e) => e.edge).filter((e) => !ids.has(e.id))
        return newE.length > 0 ? [...prev, ...newE] : prev
      })
    } catch { /* ignore */ }
  }, [])

  const refresh = useCallback(() => {
    prevNodesRef.current = ''
    prevEdgesRef.current = ''
  }, [])

  return (
    <div className="ctx-panel">
      {/* Sub-header */}
      <div className="ctx-panel__header">
        <div className="ctx-panel__views">
          <button
            className={`ctx-panel__view-btn${view === 'table' ? ' ctx-panel__view-btn--active' : ''}`}
            onClick={() => setView('table')}
          >TABLE</button>
          <button
            className={`ctx-panel__view-btn${view === 'graph' ? ' ctx-panel__view-btn--active' : ''}`}
            onClick={() => setView('graph')}
          >GRAPH</button>
        </div>

        {view === 'graph' && (
          <div className="ctx-graph-controls">
            <button className="ctx-graph-ctrl-btn" onClick={refresh} title="Refresh">⟳</button>
            <button
              className={`ctx-graph-ctrl-btn${graphMode === 'graph' ? ' ctx-graph-ctrl-btn--active' : ''}`}
              onClick={() => setGraphMode('graph')}
            >GRAPH</button>
            <button
              className={`ctx-graph-ctrl-btn${graphMode === 'folders' ? ' ctx-graph-ctrl-btn--active' : ''}`}
              onClick={() => setGraphMode('folders')}
            >FOLDERS</button>
          </div>
        )}

        <StatusChip
          status={loading && !fetchedAt ? 'offline' : ctxStatus}
          nodeCount={nodes.length}
        />
      </div>

      {/* Main area */}
      <div className="ctx-panel__body">
        {view === 'table' ? (
          <ListView nodes={nodes} selected={selected} onSelect={setSelected} />
        ) : (
          <GraphView
            nodes={nodes}
            edges={edges}
            graphMode={graphMode}
            onSelect={setSelected}
            onExpand={onExpand}
          />
        )}

        <div className={`ctx-drawer${selected ? ' ctx-drawer--open' : ''}`}>
          {selected && (
            <NodeDrawer node={selected} onClose={() => setSelected(null)} />
          )}
        </div>
      </div>
    </div>
  )
}
