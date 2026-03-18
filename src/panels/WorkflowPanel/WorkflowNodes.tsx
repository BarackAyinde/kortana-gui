import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { StepData } from './types'

// ─── Shared node shell ───────────────────────────────────────────────────────

function StepNode({
  data,
  accentColor,
  icon,
}: NodeProps<StepData> & { accentColor: string; icon: string }) {
  const executing = data.status === 'executing'
  return (
    <div
      className="wf-node"
      style={{
        borderColor: accentColor,
        boxShadow: executing
          ? `0 0 0 2px ${accentColor}, 0 0 18px 4px ${accentColor}66`
          : `0 0 8px 0 ${accentColor}44`,
      }}
    >
      <Handle type="target" position={Position.Top} className="wf-handle" />
      <div className="wf-node__icon" style={{ color: accentColor }}>{icon}</div>
      <div className="wf-node__label">{data.label}</div>
      <div className="wf-node__badge" style={{ color: accentColor }}>
        {data.stepType.toUpperCase()}
      </div>
      {executing && <div className="wf-node__pulse" style={{ background: accentColor }} />}
      <Handle type="source" position={Position.Bottom} className="wf-handle" />
    </div>
  )
}

// ─── Four typed variants ─────────────────────────────────────────────────────

export function DataNode(props: NodeProps<StepData>) {
  return <StepNode {...props} accentColor="#3b82f6" icon="⬡" />
}

export function ProcessNode(props: NodeProps<StepData>) {
  return <StepNode {...props} accentColor="#14b8a6" icon="◈" />
}

export function DecisionNode(props: NodeProps<StepData>) {
  return <StepNode {...props} accentColor="#f97316" icon="◇" />
}

export function OutputNode(props: NodeProps<StepData>) {
  return <StepNode {...props} accentColor="#00ff88" icon="▣" />
}

// ─── nodeTypes map (stable reference — defined at module level) ──────────────

export const NODE_TYPES = {
  dataNode:     DataNode,
  processNode:  ProcessNode,
  decisionNode: DecisionNode,
  outputNode:   OutputNode,
}
