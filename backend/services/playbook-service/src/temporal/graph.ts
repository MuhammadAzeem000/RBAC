// Pure graph-resolution logic for the branching workflow engine — no
// Temporal/Activity imports, deliberately, so it's unit-testable directly
// (graph.test.ts) without any Temporal test harness. workflows.ts imports
// this for its wave-based scheduler; nothing here talks to Prisma/HTTP/etc.
import type { PlaybookEdge, PlaybookStep, StepCondition } from "@responderx/shared";

export interface ResolvedGraph {
  nodes: Map<string, PlaybookStep>;
  incoming: Map<string, PlaybookEdge[]>;
  startKey: string;
}

// Empty edges means "no explicit graph" — synthesizes the same implicit
// linear chain (step[i] -> step[i+1], unconditioned) that pre-branching
// playbooks always executed as, so every playbook that predates this field
// keeps running identically. Trusts its input otherwise: a non-empty edges
// array has already passed validatePlaybookGraph (services/) at
// create/publish time, so this never re-validates structure.
export function buildGraph(steps: PlaybookStep[], edges: PlaybookEdge[]): ResolvedGraph {
  const nodes = new Map(steps.map((step) => [step.key, step]));

  const effectiveEdges: PlaybookEdge[] =
    edges.length > 0 || steps.length <= 1
      ? edges
      : steps.slice(0, -1).map((step, index) => ({
          id: `${step.key}->${steps[index + 1]!.key}`,
          source: step.key,
          target: steps[index + 1]!.key,
        }));

  const incoming = new Map<string, PlaybookEdge[]>();
  for (const key of nodes.keys()) {
    incoming.set(key, []);
  }
  for (const edge of effectiveEdges) {
    incoming.get(edge.target)?.push(edge);
  }

  const startKey = [...nodes.keys()].find((key) => (incoming.get(key)?.length ?? 0) === 0) ?? steps[0]?.key ?? "";

  return { nodes, incoming, startKey };
}

function getByPath(context: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((value, segment) => {
    if (value === null || typeof value !== "object") return undefined;
    return (value as Record<string, unknown>)[segment];
  }, context);
}

export function evaluateCondition(condition: StepCondition | undefined, context: Record<string, unknown>): boolean {
  if (!condition) return true;
  const actual = getByPath(context, condition.field);
  switch (condition.operator) {
    case "eq":
      return actual === condition.value;
    case "neq":
      return actual !== condition.value;
    case "gt":
      return typeof actual === "number" && typeof condition.value === "number" && actual > condition.value;
    case "gte":
      return typeof actual === "number" && typeof condition.value === "number" && actual >= condition.value;
    case "lt":
      return typeof actual === "number" && typeof condition.value === "number" && actual < condition.value;
    case "lte":
      return typeof actual === "number" && typeof condition.value === "number" && actual <= condition.value;
    case "contains":
      return typeof actual === "string" && condition.value !== undefined && actual.includes(String(condition.value));
    case "exists":
      return actual !== undefined && actual !== null;
    default:
      return false;
  }
}

// Scans every not-yet-resolved node and returns the ones ready to run next:
// every incoming edge's source is resolved, AND at least one incoming edge
// is "activated" (its source actually executed — wasn't itself skipped —
// and its condition, if any, evaluates true against the accumulated
// context). A node with zero activated incoming edges once all its
// predecessors are resolved is unreachable this run — the caller marks it
// resolved-but-not-executed (skip-propagation) so ITS downstream can still
// be evaluated on a later wave.
export function nextFrontier(
  graph: ResolvedGraph,
  resolved: Set<string>,
  executed: Set<string>,
  context: Record<string, unknown>,
): { ready: string[]; skipped: string[] } {
  const ready: string[] = [];
  const skipped: string[] = [];

  for (const key of graph.nodes.keys()) {
    if (resolved.has(key)) continue;
    const incomingEdges = graph.incoming.get(key) ?? [];
    const allPredecessorsResolved = incomingEdges.every((edge) => resolved.has(edge.source));
    if (!allPredecessorsResolved) continue;

    const activated = incomingEdges.some((edge) => executed.has(edge.source) && evaluateCondition(edge.condition, context));
    if (activated) {
      ready.push(key);
    } else {
      skipped.push(key);
    }
  }

  return { ready, skipped };
}

// nextFrontier only does one pass: a node can only be classified once every
// incoming edge's source is resolved. When an entire pass produces skips
// but no ready nodes (e.g. a chain of consecutively-skipped nodes before
// the next real step), those skips need to be committed to `resolved`
// before the *next* pass can even see the nodes downstream of them — this
// wraps that in a loop so the caller always gets back either a non-empty
// ready set or an empty one because the graph is genuinely exhausted, never
// a false "exhausted" from stopping one pass too early. Mutates `resolved`
// in place (same contract as nextFrontier) — the caller still owns adding
// `executed` entries once a returned node actually runs.
export function advanceFrontier(
  graph: ResolvedGraph,
  resolved: Set<string>,
  executed: Set<string>,
  context: Record<string, unknown>,
): string[] {
  while (true) {
    const { ready, skipped } = nextFrontier(graph, resolved, executed, context);
    for (const key of skipped) resolved.add(key);
    if (ready.length > 0 || skipped.length === 0) {
      return ready;
    }
  }
}
