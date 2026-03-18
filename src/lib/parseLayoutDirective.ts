import type { LayoutDirective } from '../types'
import type { DiffPayload } from '../panels/CodeEditorPanel/types'
import type { WorkflowDirective } from './postWorkflow'

interface ParseResult {
  directive: LayoutDirective | null
  diffPayload: DiffPayload | null
  workflowPayload: WorkflowDirective | null
  cleanContent: string
}

export function parseLayoutDirective(content: string): ParseResult {
  let cleanContent = content
  let directive: LayoutDirective | null = null
  let diffPayload: DiffPayload | null = null
  let workflowPayload: WorkflowDirective | null = null

  // KORTANA_LAYOUT\n{json}\nEND_LAYOUT
  const layoutMatch = cleanContent.match(/KORTANA_LAYOUT\n([\s\S]*?)\nEND_LAYOUT/)
  if (layoutMatch) {
    try {
      directive = JSON.parse(layoutMatch[1]) as LayoutDirective
      cleanContent = cleanContent.replace(/KORTANA_LAYOUT\n[\s\S]*?\nEND_LAYOUT\n?/, '').trim()
    } catch {
      // malformed — leave as-is
    }
  }

  // KORTANA_DELTA: {json}  (single-line colon format)
  const deltaMatch = cleanContent.match(/KORTANA_DELTA:\s*(\{[\s\S]*?\})\s*(?:\n|$)/)
  if (deltaMatch) {
    try {
      diffPayload = JSON.parse(deltaMatch[1]) as DiffPayload
      cleanContent = cleanContent.replace(/KORTANA_DELTA:\s*\{[\s\S]*?\}\s*(?:\n|$)/, '').trim()
    } catch {
      // malformed — leave as-is
    }
  }

  // KORTANA_WORKFLOW:create\n{json}\nEND_WORKFLOW
  const workflowMatch = cleanContent.match(/KORTANA_WORKFLOW:create\n([\s\S]*?)\nEND_WORKFLOW/)
  if (workflowMatch) {
    try {
      workflowPayload = JSON.parse(workflowMatch[1]) as WorkflowDirective
      cleanContent = cleanContent.replace(/KORTANA_WORKFLOW:create\n[\s\S]*?\nEND_WORKFLOW\n?/, '').trim()
    } catch {
      // malformed — leave as-is
    }
  }

  return { directive, diffPayload, workflowPayload, cleanContent }
}
