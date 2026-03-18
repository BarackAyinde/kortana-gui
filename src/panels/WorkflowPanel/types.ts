export type StepType = 'Data' | 'Process' | 'Decision' | 'Output'
export type StepStatus = 'idle' | 'executing' | 'done' | 'error'

export interface StepData extends Record<string, unknown> {
  label: string
  stepType: StepType
  params: Record<string, unknown>
  status: StepStatus
}

export interface WorkflowSummary {
  id: string
  label: string
}

export interface RFWorkflow {
  workflow: WorkflowSummary
  nodes: import('@xyflow/react').Node<StepData>[]
  edges: import('@xyflow/react').Edge[]
}
