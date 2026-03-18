import { useCallback, useEffect, useState } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { NODE_TYPES } from './WorkflowNodes'
import type { StepData, WorkflowSummary } from './types'

const API = 'http://localhost:4000'

export default function WorkflowPanel() {
  const [workflows, setWorkflows]       = useState<WorkflowSummary[]>([])
  const [selectedId, setSelectedId]     = useState<string>('')
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<StepData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [loading, setLoading]           = useState(false)

  // Load workflow list on mount
  useEffect(() => {
    fetch(`${API}/workflows`)
      .then((r) => r.json())
      .then((data: { workflows: WorkflowSummary[] }) => {
        setWorkflows(data.workflows ?? [])
        if (data.workflows?.length) setSelectedId(data.workflows[0].id)
      })
      .catch(() => {/* store may be offline */})
  }, [])

  // Load graph when selection changes
  const loadWorkflow = useCallback((id: string) => {
    if (!id) return
    setLoading(true)
    fetch(`${API}/workflows/${id}`)
      .then((r) => r.json())
      .then((data: { nodes: Node<StepData>[]; edges: Edge[] }) => {
        setNodes(data.nodes ?? [])
        setEdges(data.edges ?? [])
      })
      .catch(() => {/* ignore */})
      .finally(() => setLoading(false))
  }, [setNodes, setEdges])

  useEffect(() => {
    if (selectedId) loadWorkflow(selectedId)
  }, [selectedId, loadWorkflow])

  // Listen for kortana:open-workflow directive events
  useEffect(() => {
    const handler = (e: Event) => {
      const { workflowId } = (e as CustomEvent<{ workflowId: string }>).detail
      // Re-fetch the list so the dropdown shows the new workflow
      fetch(`${API}/workflows`)
        .then((r) => r.json())
        .then((data: { workflows: WorkflowSummary[] }) => {
          setWorkflows(data.workflows ?? [])
        })
        .catch(() => {/* ignore */})
        .finally(() => setSelectedId(workflowId))
    }
    window.addEventListener('kortana:open-workflow', handler)
    return () => window.removeEventListener('kortana:open-workflow', handler)
  }, [])

  return (
    <div className="wf-panel">
      {/* Header */}
      <div className="wf-panel__header">
        <span className="wf-panel__title">WORKFLOW</span>
        <select
          className="wf-panel__select"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {workflows.length === 0 && (
            <option value="">no workflows</option>
          )}
          {workflows.map((w) => (
            <option key={w.id} value={w.id}>{w.label}</option>
          ))}
        </select>
        {loading && <span className="wf-panel__loading">loading…</span>}
      </div>

      {/* Canvas */}
      <div className="wf-panel__canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={NODE_TYPES}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          colorMode="dark"
          style={{ background: '#0a0a0a' }}
          defaultEdgeOptions={{ animated: true, style: { stroke: '#00ff88', strokeWidth: 2 } }}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="#1a1a1a"
          />
          <Controls className="wf-controls" showInteractive={false} />
          <MiniMap
            className="wf-minimap"
            nodeColor={(n) => {
              const t = (n.data as StepData | undefined)?.stepType
              if (t === 'Data')     return '#3b82f6'
              if (t === 'Process')  return '#14b8a6'
              if (t === 'Decision') return '#f97316'
              if (t === 'Output')   return '#00ff88'
              return '#555'
            }}
            maskColor="#0a0a0acc"
          />
        </ReactFlow>
      </div>
    </div>
  )
}
