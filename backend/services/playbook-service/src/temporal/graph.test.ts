import type { PlaybookEdge, PlaybookStep } from "@responderx/shared";
import { advanceFrontier, buildGraph, evaluateCondition, nextFrontier } from "./graph";

function step(key: string): PlaybookStep {
  return { key, name: key, config: {} };
}

describe("buildGraph", () => {
  it("synthesizes an implicit linear chain when edges is empty", () => {
    const steps = [step("a"), step("b"), step("c")];
    const graph = buildGraph(steps, []);

    expect(graph.startKey).toBe("a");
    expect(graph.incoming.get("a")).toEqual([]);
    expect(graph.incoming.get("b")).toEqual([{ id: "a->b", source: "a", target: "b" }]);
    expect(graph.incoming.get("c")).toEqual([{ id: "b->c", source: "b", target: "c" }]);
  });

  it("treats a single step with no edges as its own start", () => {
    const graph = buildGraph([step("only")], []);
    expect(graph.startKey).toBe("only");
    expect(graph.incoming.get("only")).toEqual([]);
  });

  it("uses explicit edges as given when non-empty", () => {
    const steps = [step("a"), step("b")];
    const edges: PlaybookEdge[] = [{ id: "e1", source: "a", target: "b" }];
    const graph = buildGraph(steps, edges);
    expect(graph.startKey).toBe("a");
    expect(graph.incoming.get("b")).toEqual(edges);
  });
});

describe("evaluateCondition", () => {
  it("is always true when no condition is given", () => {
    expect(evaluateCondition(undefined, {})).toBe(true);
  });

  it("evaluates a dot-path field against the accumulated context", () => {
    const context = { "lookup-ip": { stats: { malicious: 3 } } };
    expect(evaluateCondition({ field: "lookup-ip.stats.malicious", operator: "gt", value: 0 }, context)).toBe(true);
    expect(evaluateCondition({ field: "lookup-ip.stats.malicious", operator: "gt", value: 10 }, context)).toBe(false);
    expect(evaluateCondition({ field: "lookup-ip.stats.malicious", operator: "eq", value: 3 }, context)).toBe(true);
    expect(evaluateCondition({ field: "lookup-ip.missing", operator: "exists" }, context)).toBe(false);
    expect(evaluateCondition({ field: "lookup-ip.stats.malicious", operator: "exists" }, context)).toBe(true);
  });

  it("supports contains for strings", () => {
    const context = { classify: { verdict: "malicious-confirmed" } };
    expect(evaluateCondition({ field: "classify.verdict", operator: "contains", value: "malicious" }, context)).toBe(true);
    expect(evaluateCondition({ field: "classify.verdict", operator: "contains", value: "benign" }, context)).toBe(false);
  });
});

describe("nextFrontier", () => {
  it("computes an if/else branch: only the passing edge's target is ready", () => {
    const steps = [step("start"), step("high"), step("low")];
    const edges: PlaybookEdge[] = [
      { id: "e1", source: "start", target: "high", condition: { field: "start.score", operator: "gte", value: 5 } },
      { id: "e2", source: "start", target: "low", condition: { field: "start.score", operator: "lt", value: 5 } },
    ];
    const graph = buildGraph(steps, edges);
    const resolved = new Set(["start"]);
    const executed = new Set(["start"]);
    const context = { start: { score: 7 } };

    const { ready, skipped } = nextFrontier(graph, resolved, executed, context);
    expect(ready).toEqual(["high"]);
    expect(skipped).toEqual(["low"]);
  });

  it("computes a fan-out/fan-in (OR-join) diamond: join fires once both branches resolve", () => {
    const steps = [step("start"), step("left"), step("right"), step("join")];
    const edges: PlaybookEdge[] = [
      { id: "e1", source: "start", target: "left" },
      { id: "e2", source: "start", target: "right" },
      { id: "e3", source: "left", target: "join" },
      { id: "e4", source: "right", target: "join" },
    ];
    const graph = buildGraph(steps, edges);

    let resolved = new Set(["start"]);
    let executed = new Set(["start"]);
    let wave = nextFrontier(graph, resolved, executed, {});
    expect(wave.ready.sort()).toEqual(["left", "right"]);

    resolved = new Set([...resolved, "left", "right"]);
    executed = new Set([...executed, "left", "right"]);
    wave = nextFrontier(graph, resolved, executed, {});
    expect(wave.ready).toEqual(["join"]);
  });

  it("skips a node whose only incoming edge's condition is false, without blocking evaluation forever", () => {
    const steps = [step("start"), step("maybe"), step("after")];
    const edges: PlaybookEdge[] = [
      { id: "e1", source: "start", target: "maybe", condition: { field: "start.flag", operator: "eq", value: true } },
      { id: "e2", source: "maybe", target: "after" },
    ];
    const graph = buildGraph(steps, edges);
    const resolved = new Set(["start"]);
    const executed = new Set(["start"]);
    const context = { start: { flag: false } };

    const wave = nextFrontier(graph, resolved, executed, context);
    expect(wave.ready).toEqual([]);
    expect(wave.skipped).toEqual(["maybe"]);
  });
});

describe("advanceFrontier", () => {
  it("propagates a chain of consecutive skips in one call instead of stopping after the first pass", () => {
    // start -[false]-> skip1 -> skip2 -> skip3 -> after ; start -> after (direct, unconditioned)
    const steps = [step("start"), step("skip1"), step("skip2"), step("skip3"), step("after")];
    const edges: PlaybookEdge[] = [
      { id: "e1", source: "start", target: "skip1", condition: { field: "start.flag", operator: "eq", value: true } },
      { id: "e2", source: "skip1", target: "skip2" },
      { id: "e3", source: "skip2", target: "skip3" },
      { id: "e4", source: "skip3", target: "after" },
      { id: "e5", source: "start", target: "after" },
    ];
    const graph = buildGraph(steps, edges);
    const resolved = new Set(["start"]);
    const executed = new Set(["start"]);
    const context = { start: { flag: false } };

    const ready = advanceFrontier(graph, resolved, executed, context);

    expect(ready).toEqual(["after"]);
    expect(resolved.has("skip1")).toBe(true);
    expect(resolved.has("skip2")).toBe(true);
    expect(resolved.has("skip3")).toBe(true);
    expect(executed.has("skip1")).toBe(false);
  });

  it("returns an empty ready list once the whole graph is resolved", () => {
    const steps = [step("a")];
    const graph = buildGraph(steps, []);
    const resolved = new Set(["a"]);
    const executed = new Set(["a"]);
    expect(advanceFrontier(graph, resolved, executed, {})).toEqual([]);
  });
});
