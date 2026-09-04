import type { PlaybookEdge, PlaybookStep } from '@/types/playbook'

// Mirrors backend/services/playbook-service/src/temporal/graph.ts's buildGraph
// fallback: empty edges means "no explicit graph", so both sides synthesize
// the same implicit linear chain rather than one of them guessing. Kept as
// a small, separate pure function here (not imported from the backend)
// since bundling a Temporal-sandboxed workflow file into the frontend isn't
// meaningful — see the branching workflow plan's note on this duplication.
export function synthesizeLinearEdges(steps: PlaybookStep[]): PlaybookEdge[] {
  if (steps.length <= 1) return []
  return steps.slice(0, -1).map((step, index) => ({
    id: `${step.key}->${steps[index + 1]!.key}`,
    source: step.key,
    target: steps[index + 1]!.key,
  }))
}

// Simple topological-layer auto-layout for a graph that has no stored
// canvas positions (every playbook that predates this feature) — BFS from
// the start step(s), x = position within its layer, y = layer depth. Not a
// general Sugiyama-style layout (no edge-crossing minimization); good
// enough for laying out a freshly-opened legacy playbook, which the user
// can then freely rearrange and save.
export function layoutFromSteps(
  steps: PlaybookStep[],
  edges: PlaybookEdge[],
): Record<string, { x: number; y: number }> {
  const effectiveEdges = edges.length > 0 ? edges : synthesizeLinearEdges(steps)
  const incoming = new Map<string, number>(steps.map((s) => [s.key, 0]))
  const outgoing = new Map<string, string[]>()
  for (const edge of effectiveEdges) {
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1)
    if (!outgoing.has(edge.source)) outgoing.set(edge.source, [])
    outgoing.get(edge.source)!.push(edge.target)
  }

  const starts = steps.filter((s) => (incoming.get(s.key) ?? 0) === 0).map((s) => s.key)
  const layer = new Map<string, number>()
  const queue = starts.length > 0 ? [...starts] : steps.slice(0, 1).map((s) => s.key)
  queue.forEach((key) => layer.set(key, 0))

  let i = 0
  while (i < queue.length) {
    const key = queue[i++]!
    const depth = layer.get(key) ?? 0
    for (const next of outgoing.get(key) ?? []) {
      if (!layer.has(next) || layer.get(next)! < depth + 1) {
        layer.set(next, depth + 1)
        queue.push(next)
      }
    }
  }

  const countPerLayer = new Map<number, number>()
  const positions: Record<string, { x: number; y: number }> = {}
  for (const step of steps) {
    const depth = layer.get(step.key) ?? 0
    const indexInLayer = countPerLayer.get(depth) ?? 0
    countPerLayer.set(depth, indexInLayer + 1)
    positions[step.key] = { x: indexInLayer * 260, y: depth * 150 }
  }
  return positions
}

// Client-side mirror of backend/services/playbook-service/src/utils/playbookGraph.ts's
// validatePlaybookGraph — same rules, so the user sees a graph error before
// a round trip instead of only after Publish/Create fails server-side. A
// no-op (no error) when edges is empty, same "legacy linear" exemption.
export function validateGraphStructure(steps: PlaybookStep[], edges: PlaybookEdge[]): string | null {
  if (edges.length === 0) return null

  const keys = new Set(steps.map((s) => s.key))
  if (keys.size !== steps.length) return 'Step keys must be unique.'

  const incoming = new Map<string, PlaybookEdge[]>([...keys].map((k) => [k, []]))
  const outgoing = new Map<string, PlaybookEdge[]>([...keys].map((k) => [k, []]))
  for (const edge of edges) {
    if (!keys.has(edge.source) || !keys.has(edge.target)) {
      return `Edge references a step that no longer exists.`
    }
    incoming.get(edge.target)!.push(edge)
    outgoing.get(edge.source)!.push(edge)
  }

  const starts = [...keys].filter((k) => incoming.get(k)!.length === 0)
  if (starts.length !== 1) {
    return `Graph must have exactly one start step (no incoming edges); found ${starts.length}.`
  }
  const startKey = starts[0]!

  const WHITE = 0
  const GRAY = 1
  const BLACK = 2
  const color = new Map<string, number>([...keys].map((k) => [k, WHITE]))
  const visited = new Set<string>()

  function dfs(node: string): string | null {
    color.set(node, GRAY)
    for (const edge of outgoing.get(node) ?? []) {
      const target = edge.target
      if (color.get(target) === GRAY) return target
      if (color.get(target) === WHITE) {
        const cycleNode = dfs(target)
        if (cycleNode) return cycleNode
      }
    }
    color.set(node, BLACK)
    visited.add(node)
    return null
  }

  const cycleNode = dfs(startKey)
  if (cycleNode) return `Graph contains a cycle involving step "${cycleNode}".`

  const unreachable = [...keys].filter((k) => !visited.has(k))
  if (unreachable.length > 0) {
    return `Step(s) unreachable from the start step: ${unreachable.join(', ')}.`
  }

  return null
}
