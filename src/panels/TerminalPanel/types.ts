export type ShellMode = 'stream' | 'shell'

export interface ShellState {
  cwd: string
  cmdHistory: string[]
}

export interface GraphPath {
  path: ApiNode[]
  edges: ApiEdge[]
  length: number
}

export interface ApiNode {
  id: string
  type: string
  label: string
  body: string
  status: string
  confidence: number
  source: string
  session_id: string
  created_at: string
  updated_at: string
}

export interface ApiEdge {
  id: string
  type: string
  from_id: string
  to_id: string
  created_at: string
}

export interface NodeSummary {
  id: string
  type: string
  label: string
  status: string
  created_at: string
}
