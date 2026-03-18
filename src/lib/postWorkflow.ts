const API = 'http://localhost:4000'

export interface WorkflowStep {
  id?: string
  label: string
  stepType: 'Data' | 'Process' | 'Decision' | 'Output'
  params?: Record<string, unknown>
  position?: { x: number; y: number }
}

export interface WorkflowDirective {
  id?: string
  label: string
  description?: string
  steps: WorkflowStep[]
}

// ─── POST a single node/edge, skip 409 (already exists) ──────────────────────

async function apiPost(path: string, body: unknown): Promise<void> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (res.status === 409) return
  if (!res.ok) {
    const text = await res.text()
    console.error(`[postWorkflow] POST ${path} → ${res.status}`, text)
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────
// Returns the workflow ID so the caller can switch the WorkflowPanel to it.

export async function postWorkflow(payload: WorkflowDirective): Promise<string> {
  const wfId      = payload.id ?? `workflow-${Date.now()}`
  const sessionId = `directive-${Date.now()}`

  // 1. WorkflowNode
  await apiPost('/nodes', {
    id:         wfId,
    type:       'WorkflowNode',
    label:      payload.label,
    body:       JSON.stringify({ description: payload.description ?? '' }),
    status:     'accepted',
    confidence: 1.0,
    source:     'KORTANA_WORKFLOW',
    session_id: sessionId,
  })

  // 2. WorkflowStep nodes + contains edges
  const stepIds: string[] = []
  for (let i = 0; i < payload.steps.length; i++) {
    const step   = payload.steps[i]
    const stepId = step.id ?? `${wfId}-step-${i + 1}`
    stepIds.push(stepId)

    await apiPost('/nodes', {
      id:         stepId,
      type:       'WorkflowStep',
      label:      step.label,
      body:       JSON.stringify({
        stepType: step.stepType,
        params:   step.params   ?? {},
        status:   'idle',
        position: step.position ?? { x: 250, y: 80 + i * 150 },
      }),
      status:     'accepted',
      confidence: 1.0,
      source:     'KORTANA_WORKFLOW',
      session_id: sessionId,
    })

    await apiPost('/edges', {
      type:    'contains',
      from_id: wfId,
      to_id:   stepId,
    })
  }

  // 3. workflow_sequence edges (sequential by default)
  for (let i = 0; i < stepIds.length - 1; i++) {
    await apiPost('/edges', {
      type:    'workflow_sequence',
      from_id: stepIds[i],
      to_id:   stepIds[i + 1],
    })
  }

  return wfId
}
