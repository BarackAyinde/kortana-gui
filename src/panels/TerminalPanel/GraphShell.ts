// GraphShell.ts — command parser and executor (pure TypeScript, no JSX)
import { COMMANDS } from './graphCommands'
import type { ApiNode, ApiEdge, NodeSummary } from './types'

const CONTEXT_API = 'http://localhost:4000'
const TIMEOUT_MS = 3000

// ─── ANSI colours ─────────────────────────────────────────────────────────────

const G = '\x1b[32m'  // green
const R = '\x1b[31m'  // red
const Y = '\x1b[33m'  // yellow
const C = '\x1b[36m'  // cyan
const B = '\x1b[34m'  // blue
const D = '\x1b[2m'   // dim
const O = '\x1b[0m'   // reset

// ─── Node type ↔ path segment mapping ─────────────────────────────────────────

const TYPE_TO_PATH: Record<string, string> = {
  Intent: 'intents', Requirement: 'requirements', Constraint: 'constraints',
  Decision: 'decisions', Component: 'components', Implementation: 'implementations',
  Question: 'questions', Risk: 'risks', Person: 'persons', Signal: 'signals',
  Pattern: 'patterns', Space: 'spaces', Goal: 'goals', Insight: 'insights', Thread: 'threads',
}

const PATH_TO_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(TYPE_TO_PATH).map(([k, v]) => [v, k]),
)

// ─── API helper with timeout ───────────────────────────────────────────────────

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${CONTEXT_API}${path}`, { ...options, signal: controller.signal })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`HTTP ${res.status}${text ? ': ' + text.slice(0, 120) : ''}`)
    }
    return res.json() as Promise<T>
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw new Error('Request timed out (3s)')
    throw err
  } finally {
    clearTimeout(timer)
  }
}

// ─── Path helpers ─────────────────────────────────────────────────────────────

interface CwdInfo {
  level: 'root' | 'type' | 'node'
  typeName?: string
  typeSegment?: string
  nodeId?: string
}

function parseCwd(cwd: string): CwdInfo {
  if (cwd === '/') return { level: 'root' }
  const parts = cwd.split('/').filter(Boolean)
  const typeSegment = parts[0]!
  const typeName = PATH_TO_TYPE[typeSegment]
  if (!typeName) return { level: 'root' }
  if (parts.length === 1) return { level: 'type', typeName, typeSegment }
  return { level: 'node', typeName, typeSegment, nodeId: parts[1] }
}

function typeToPath(type: string): string {
  return TYPE_TO_PATH[type] ?? type.toLowerCase() + 's'
}

// ─── GraphShell ───────────────────────────────────────────────────────────────

export class GraphShell {
  private cwd = '/'
  private cmdHistory: string[] = []

  // Set by commands that need a y/N confirmation before proceeding.
  // Cleared immediately after use.
  pendingConfirm: ((input: string) => Promise<void>) | null = null

  getCwd(): string { return this.cwd }

  getPrompt(): string {
    return `${C}kortana-graph${O} [${G}${this.cwd}${O}]> `
  }

  addHistory(cmd: string): void {
    if (cmd && cmd !== this.cmdHistory[0]) {
      this.cmdHistory = [cmd, ...this.cmdHistory.slice(0, 99)]
    }
  }

  getHistory(): string[] { return this.cmdHistory }

  async execute(raw: string, write: (s: string) => void): Promise<void> {
    const trimmed = raw.trim()
    if (!trimmed) return
    this.addHistory(trimmed)

    const parts = trimmed.split(/\s+/)
    const command = parts[0] ?? ''
    const args = parts.slice(1)

    switch (command) {
      case 'pwd':     this.execPwd(write); break
      case 'ls':      await this.execLs(args, write); break
      case 'cd':      await this.execCd(args, write); break
      case 'cat':     await this.execCat(args, write); break
      case 'grep':    await this.execGrep(args, write); break
      case 'find':    await this.execGrep(args, write); break
      case 'link':    await this.execLink(args, write); break
      case 'unlink':  await this.execUnlink(args, write); break
      case 'touch':   await this.execTouch(args, write); break
      case 'rm':      await this.execRm(args, write); break
      case 'history': this.execHistoryCmd(write); break
      case 'help':    this.execHelp(args, write); break
      case 'clear':   break // handled by caller
      case '':        break
      default:
        write(`${R}Unknown command: ${command}${O} — type ${D}help${O} for commands\r\n`)
    }
  }

  // ─── Command implementations ────────────────────────────────────────────────

  private execPwd(write: (s: string) => void): void {
    write(`${this.cwd}\r\n`)
  }

  private async execLs(args: string[], write: (s: string) => void): Promise<void> {
    const targetPath = args[0] ? this.resolvePath(args[0]) : this.cwd
    const info = parseCwd(targetPath)

    if (info.level === 'root') {
      const tree = await api<Record<string, { count: number; nodes: NodeSummary[] }>>('/nodes/tree')
      const sorted = Object.entries(tree).sort(([a], [b]) => a.localeCompare(b))
      for (const [type, { count }] of sorted) {
        const seg = typeToPath(type)
        write(`${B}${seg}/${O}  ${D}(${count})${O}\r\n`)
      }
      return
    }

    if (info.level === 'type' && info.typeName) {
      const nodes = await api<ApiNode[]>(`/nodes?type=${info.typeName}`)
      if (nodes.length === 0) { write(`${D}(empty)${O}\r\n`); return }
      for (const n of nodes) {
        write(`${G}${n.id.padEnd(36)}${O}  ${n.label}\r\n`)
      }
      return
    }

    if (info.level === 'node' && info.nodeId) {
      await this.renderNodeSummary(info.nodeId, write)
      return
    }

    write(`${R}No such path: ${targetPath}${O}\r\n`)
  }

  private async execCd(args: string[], write: (s: string) => void): Promise<void> {
    const target = args[0]
    if (!target || target === '/') { this.cwd = '/'; return }

    const resolved = this.resolvePath(target)
    if (resolved === '/') { this.cwd = '/'; return }

    const info = parseCwd(resolved)

    if (info.level === 'type' && info.typeName) {
      const tree = await api<Record<string, unknown>>('/nodes/tree')
      if (!tree[info.typeName]) { write(`${R}No such path: ${resolved}${O}\r\n`); return }
      this.cwd = resolved
      return
    }

    if (info.level === 'node' && info.nodeId) {
      const node = await api<ApiNode>(`/nodes/${info.nodeId}`).catch(() => null)
      if (!node) { write(`${R}No such path: ${resolved}${O}\r\n`); return }
      this.cwd = `/${typeToPath(node.type)}/${node.id}`
      return
    }

    write(`${R}No such path: ${resolved}${O}\r\n`)
  }

  private async execCat(args: string[], write: (s: string) => void): Promise<void> {
    let nodeId: string
    if (!args[0] || args[0] === '.') {
      const info = parseCwd(this.cwd)
      if (info.level !== 'node' || !info.nodeId) {
        write(`${R}Not at node level. Use: cat <node-id>${O}\r\n`)
        return
      }
      nodeId = info.nodeId
    } else {
      nodeId = args[0]
    }
    await this.renderNodeFull(nodeId, write)
  }

  private async execGrep(args: string[], write: (s: string) => void): Promise<void> {
    let query = ''
    let type: string | undefined
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--type' && args[i + 1]) { type = args[++i]; continue }
      if (!query) query = args[i] ?? ''
    }
    if (!query) { write(`${R}Usage: grep <query> [--type <nodeType>]${O}\r\n`); return }
    if (query.length < 2) { write(`${R}Query must be at least 2 characters${O}\r\n`); return }

    const params = new URLSearchParams({ q: query })
    if (type) params.set('type', type)
    const result = await api<{ results: ApiNode[]; count: number; query: string }>(`/nodes/search?${params.toString()}`)

    if (result.count === 0) { write(`${D}No results for "${query}"${O}\r\n`); return }
    for (const n of result.results) {
      const where = n.label.toLowerCase().includes(query.toLowerCase()) ? 'label' : 'body'
      write(`${B}[${n.id}]${O} ${n.label}  ${D}— matched in: ${where}${O}\r\n`)
    }
    write(`${D}${result.count} result${result.count !== 1 ? 's' : ''}${O}\r\n`)
  }

  private async execLink(args: string[], write: (s: string) => void): Promise<void> {
    let sourceId = '', targetId = '', edgeType = 'related-to'
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--type' && args[i + 1]) { edgeType = args[++i]!; continue }
      if (!sourceId) { sourceId = args[i]!; continue }
      if (!targetId) { targetId = args[i]!; continue }
    }
    if (!sourceId || !targetId) {
      write(`${R}Usage: link <source-id> <target-id> [--type <edge_type>]${O}\r\n`)
      return
    }
    const edge = await api<ApiEdge>('/edges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from_id: sourceId, to_id: targetId, type: edgeType }),
    })
    write(`${G}Edge created:${O} ${sourceId} ${G}→${O} ${targetId}  ${D}(${edge.type})${O}\r\n`)
  }

  private async execUnlink(args: string[], write: (s: string) => void): Promise<void> {
    const [sourceId, targetId] = args
    if (!sourceId || !targetId) {
      write(`${R}Usage: unlink <source-id> <target-id>${O}\r\n`)
      return
    }
    const edges = await api<ApiEdge[]>(`/edges?from_id=${sourceId}&to_id=${targetId}`)
    if (edges.length === 0) { write(`${R}No edge found: ${sourceId} → ${targetId}${O}\r\n`); return }
    const edge = edges[0]!
    write(`Remove edge ${Y}${sourceId}${O} → ${Y}${targetId}${O} (${edge.type})? ${D}[y/N]${O} `)
    this.pendingConfirm = async (input: string) => {
      if (input.trim().toLowerCase() === 'y') {
        await api(`/edges/${edge.id}`, { method: 'DELETE' })
        write(`\r\n${G}Done${O}\r\n`)
      } else {
        write(`\r\n${D}Cancelled${O}\r\n`)
      }
    }
  }

  private async execTouch(args: string[], write: (s: string) => void): Promise<void> {
    let nodeId = ''
    let nodeType: string | undefined
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--type' && args[i + 1]) { nodeType = args[++i]; continue }
      if (!nodeId) nodeId = args[i]!
    }
    if (!nodeId) { write(`${R}Usage: touch <node-id> [--type <nodeType>]${O}\r\n`); return }

    if (!nodeType) {
      const info = parseCwd(this.cwd)
      nodeType = info.typeName ?? 'Component'
    }

    const node = await api<ApiNode>('/nodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: nodeId, type: nodeType, label: nodeId, source: 'shell', session_id: 'graph-shell' }),
    })

    write(`${G}Node created:${O} ${node.id}  ${D}[${node.type}]${O} — opening in Code Editor\r\n`)

    // Signal CodeEditorPanel to open a new tab
    window.dispatchEvent(new CustomEvent('kortana:open-file', {
      detail: { nodeId: node.id, label: node.label },
    }))
  }

  private async execRm(args: string[], write: (s: string) => void): Promise<void> {
    const nodeId = args[0]
    if (!nodeId) { write(`${R}Usage: rm <node-id>${O}\r\n`); return }
    write(`Delete ${Y}${nodeId}${O}? This cannot be undone. ${D}[y/N]${O} `)
    this.pendingConfirm = async (input: string) => {
      if (input.trim().toLowerCase() === 'y') {
        await api(`/nodes/${nodeId}`, { method: 'DELETE' })
        write(`\r\n${G}Deleted ${nodeId}${O}\r\n`)
      } else {
        write(`\r\n${D}Cancelled${O}\r\n`)
      }
    }
  }

  private execHistoryCmd(write: (s: string) => void): void {
    const recent = this.cmdHistory.slice(0, 20)
    recent.forEach((cmd, i) => {
      write(`${D}${String(recent.length - i).padStart(3)}.${O}  ${cmd}\r\n`)
    })
  }

  private execHelp(args: string[], write: (s: string) => void): void {
    const cmd = args[0]
    if (cmd) {
      const def = COMMANDS[cmd]
      if (def) {
        write(`${G}${cmd}${O}  ${def.usage}\r\n${D}${def.description}${O}\r\n`)
      } else {
        write(`${R}Unknown command: ${cmd}${O}\r\n`)
      }
      return
    }
    for (const [name, def] of Object.entries(COMMANDS)) {
      write(`${G}${name.padEnd(10)}${O}  ${D}${def.description}${O}\r\n`)
    }
  }

  // ─── Path resolution ─────────────────────────────────────────────────────────

  private resolvePath(target: string): string {
    if (target === '/' || target === '') return '/'
    if (target === '..') {
      const parts = this.cwd.split('/').filter(Boolean)
      parts.pop()
      return parts.length === 0 ? '/' : '/' + parts.join('/')
    }
    if (target.startsWith('/')) return target
    return (this.cwd === '/' ? '' : this.cwd) + '/' + target
  }

  // ─── Render helpers ───────────────────────────────────────────────────────────

  private async renderNodeSummary(nodeId: string, write: (s: string) => void): Promise<void> {
    const result = await api<{
      node: ApiNode
      neighbours: {
        outgoing: Array<{ edge: ApiEdge; node: ApiNode }>
        incoming: Array<{ edge: ApiEdge; node: ApiNode }>
      }
    }>(`/nodes/${nodeId}/neighbours`)
    const n = result.node
    write(`${D}${n.id}${O}  ${G}${n.label}${O}  ${D}[${n.status}]${O}\r\n`)
    write(`  edges: ${result.neighbours.outgoing.length} out, ${result.neighbours.incoming.length} in\r\n`)
  }

  private async renderNodeFull(nodeId: string, write: (s: string) => void): Promise<void> {
    const result = await api<{
      node: ApiNode
      neighbours: {
        outgoing: Array<{ edge: ApiEdge; node: ApiNode }>
        incoming: Array<{ edge: ApiEdge; node: ApiNode }>
      }
    }>(`/nodes/${nodeId}/neighbours`)
    const n = result.node
    const bar = `${D}──────────────────────────────────────────${O}`
    write(bar + '\r\n')
    write(`${B}[${n.id}]${O} ${G}${n.label}${O}  ${D}(${n.status})${O}\r\n`)
    write(bar + '\r\n')
    if (n.body) {
      for (const line of n.body.split('\n')) write(`${line}\r\n`)
      write('\r\n')
    }
    const { outgoing, incoming } = result.neighbours
    if (outgoing.length > 0 || incoming.length > 0) {
      write(`${D}Edges:${O}\r\n`)
      for (const { edge, node: target } of outgoing) {
        write(`  ${G}→${O} ${target.id}  ${D}(${edge.type})${O}\r\n`)
      }
      for (const { edge, node: source } of incoming) {
        write(`  ${Y}←${O} ${source.id}  ${D}(${edge.type})${O}\r\n`)
      }
    }
    write(bar + '\r\n')
  }

  // ─── Autocomplete ─────────────────────────────────────────────────────────────

  async getAutocompleteOptions(partial: string): Promise<string[]> {
    try {
      const info = parseCwd(this.cwd)
      if (info.level === 'root') {
        return Object.values(TYPE_TO_PATH).filter((s) => s.startsWith(partial))
      }
      if (info.level === 'type' && info.typeName) {
        const nodes = await api<ApiNode[]>(`/nodes?type=${info.typeName}`)
        return nodes.map((n) => n.id).filter((id) => id.startsWith(partial))
      }
    } catch {
      // autocomplete failures are silent
    }
    return []
  }
}
