import type { PlaybookEdge, PlaybookStep } from "@responderx/shared";
import { HttpError } from "../middlewares/errorHandler";

// Structural validation for an explicit step graph, run once at
// create/publish time (services/playbookCatalog.service.ts) — never at
// execution time, since by then the graph has already been accepted.
//
// A no-op when `edges` is empty: an empty-edges playbook is the legacy
// linear shape, which every consumer (this validator, the Temporal
// workflow's graph.ts, the designer canvas) treats as "synthesize an
// implicit chain over `steps`" rather than a graph that needs validating.
export function validatePlaybookGraph(steps: PlaybookStep[], edges: PlaybookEdge[]): void {
  if (edges.length === 0) {
    return;
  }

  const stepKeys = new Set<string>();
  for (const step of steps) {
    if (stepKeys.has(step.key)) {
      throw new HttpError(400, `Duplicate step key "${step.key}"`);
    }
    stepKeys.add(step.key);
  }

  const incoming = new Map<string, PlaybookEdge[]>();
  const outgoing = new Map<string, PlaybookEdge[]>();
  for (const key of stepKeys) {
    incoming.set(key, []);
    outgoing.set(key, []);
  }
  for (const edge of edges) {
    if (!stepKeys.has(edge.source)) {
      throw new HttpError(400, `Edge "${edge.id}" references unknown source step "${edge.source}"`);
    }
    if (!stepKeys.has(edge.target)) {
      throw new HttpError(400, `Edge "${edge.id}" references unknown target step "${edge.target}"`);
    }
    incoming.get(edge.target)!.push(edge);
    outgoing.get(edge.source)!.push(edge);
  }

  const startKeys = [...stepKeys].filter((key) => incoming.get(key)!.length === 0);
  if (startKeys.length === 0) {
    throw new HttpError(400, "Graph has no start step (every step has an incoming edge, implying a cycle)");
  }
  if (startKeys.length > 1) {
    throw new HttpError(
      400,
      `Graph must have exactly one start step (no incoming edges); found ${startKeys.length}: ${startKeys.join(", ")}`,
    );
  }
  const startKey = startKeys[0]!;

  // Cycle detection via DFS with a recursion-stack, walking from the start
  // node only — a cycle anywhere reachable from start is still a cycle the
  // workflow could get stuck on.
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>([...stepKeys].map((key) => [key, WHITE]));
  const visitOrder: string[] = [];

  function detectCycle(node: string): string | null {
    color.set(node, GRAY);
    for (const edge of outgoing.get(node) ?? []) {
      const target = edge.target;
      const targetColor = color.get(target);
      if (targetColor === GRAY) {
        return target;
      }
      if (targetColor === WHITE) {
        const cycleNode = detectCycle(target);
        if (cycleNode) {
          return cycleNode;
        }
      }
    }
    color.set(node, BLACK);
    visitOrder.push(node);
    return null;
  }

  const cycleNode = detectCycle(startKey);
  if (cycleNode) {
    throw new HttpError(400, `Graph contains a cycle involving step "${cycleNode}"`);
  }

  const reachable = new Set(visitOrder);
  const unreachable = [...stepKeys].filter((key) => !reachable.has(key));
  if (unreachable.length > 0) {
    throw new HttpError(400, `Step(s) unreachable from the start step "${startKey}": ${unreachable.join(", ")}`);
  }
}
