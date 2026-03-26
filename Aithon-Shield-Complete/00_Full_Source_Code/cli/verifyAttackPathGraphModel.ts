/**
 * Pure-model checks for attack path graph (no HTTP).
 */
import { buildAttackPathGraph, classifyAttackPhase } from "@shared/attackPathGraphModel";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function main() {
  console.log("── verify:attack-path-graph-model ──");

  assert(classifyAttackPhase({ id: "1", title: "SQL injection", category: "Injection", severity: "HIGH" }) === "execution", "SQL → execution");
  assert(classifyAttackPhase({ id: "2", title: "Hardcoded API key", category: "Secrets", severity: "CRITICAL" }) === "privilege", "API key → privilege");

  const { nodes, edges } = buildAttackPathGraph(
    [
      { id: "a", title: "XSS", category: "Web", severity: "MEDIUM", status: "open" },
      { id: "b", title: "Open port scan", category: "Network", severity: "LOW", status: "open" },
    ],
    {},
  );

  assert(nodes.some((n) => n.kind === "finding" && n.findingId === "a"), "finding node a");
  assert(nodes.some((n) => n.kind === "finding" && n.findingId === "b"), "finding node b");
  assert(edges.length > 0, "has edges");

  const empty = buildAttackPathGraph([], {});
  assert(empty.nodes.length === 1 && empty.nodes[0]!.kind === "start", "empty → start only");

  console.log("  ✔ classifyAttackPhase + buildAttackPathGraph OK");
}

main();
