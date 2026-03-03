const NODES_URL = 'http://localhost:4000/nodes'
const CACHE_TTL_MS = 30_000

interface ContextSnapshot {
  nodeCount: number
  markdown: string
  fetchedAt: number
  error: string | null
}

// Module-level cache — shared across all callers
let cache: ContextSnapshot | null = null

function formatMarkdown(nodes: Record<string, unknown>[]): string {
  if (nodes.length === 0) return ''

  // Group by type
  const groups: Record<string, typeof nodes> = {}
  for (const node of nodes) {
    const t = String(node.type ?? 'Unknown')
    if (!groups[t]) groups[t] = []
    groups[t].push(node)
  }

  const lines: string[] = [`## Context Graph (${nodes.length} nodes)\n`]

  for (const [type, members] of Object.entries(groups)) {
    lines.push(`### ${type}`)
    for (const n of members) {
      const status = n.status ? ` (${n.status})` : ''
      lines.push(`- [${n.id}] ${n.label}${status}`)
      // Include body for high-signal node types
      if (n.body && ['Decision', 'Requirement', 'Constraint', 'Risk'].includes(String(n.type))) {
        lines.push(`  > ${String(n.body).replace(/\n/g, ' ').slice(0, 200)}`)
      }
    }
    lines.push('')
  }

  return lines.join('\n')
}

export async function getContextSnapshot(): Promise<ContextSnapshot> {
  const now = Date.now()

  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) return cache

  try {
    const res = await fetch(NODES_URL)
    if (!res.ok) throw new Error(`/nodes returned ${res.status}`)
    const nodes: Record<string, unknown>[] = await res.json()

    cache = {
      nodeCount: nodes.length,
      markdown: formatMarkdown(nodes),
      fetchedAt: now,
      error: null,
    }
  } catch (err) {
    cache = {
      nodeCount: cache?.nodeCount ?? 0,
      markdown: cache?.markdown ?? '',
      fetchedAt: now,
      error: String(err),
    }
  }

  return cache
}
