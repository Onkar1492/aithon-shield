/**
 * Heuristic attack-path graph from findings (no external graph DB).
 * Maps findings into MITRE-inspired phases for visualization only.
 */

export type AttackPhaseId =
  | "recon"
  | "initial"
  | "execution"
  | "privilege"
  | "data"
  | "impact";

export const ATTACK_PHASES: { id: AttackPhaseId; label: string; order: number }[] = [
  { id: "recon", label: "Reconnaissance", order: 0 },
  { id: "initial", label: "Initial access", order: 1 },
  { id: "execution", label: "Execution / injection", order: 2 },
  { id: "privilege", label: "Credentials / session", order: 3 },
  { id: "data", label: "Data exposure", order: 4 },
  { id: "impact", label: "Impact / availability", order: 5 },
];

export type AttackPathFindingInput = {
  id: string;
  title: string;
  category: string;
  severity: string;
  asset?: string | null;
  cwe?: string | null;
  status?: string | null;
  scanType?: string | null;
};

export type AttackPathNodeKind = "start" | "phase" | "finding";

export type AttackPathNode = {
  id: string;
  kind: AttackPathNodeKind;
  label: string;
  phaseId?: AttackPhaseId;
  findingId?: string;
  severity?: string;
};

export type AttackPathEdge = { from: string; to: string };

function textBlob(f: AttackPathFindingInput): string {
  return `${f.category} ${f.title} ${f.cwe ?? ""} ${f.asset ?? ""}`.toLowerCase();
}

/** Best-effort phase from category/title/CWE — explainable heuristics, not ground truth. */
export function classifyAttackPhase(f: AttackPathFindingInput): AttackPhaseId {
  const t = textBlob(f);
  if (/infrastructure as code|\biac\b|terraform|dockerfile|kubernetes|helm|docker compose/.test(t)) return "initial";
  if (/container image|manifest|layer|registry|image tag/.test(t)) return "initial";
  if (/openapi|swagger|api spec|rest api|api contract|\/v1\//.test(t)) return "initial";
  if (/secret|credential|password|token|api[\s_-]?key|jwt|oauth|session|auth|login|mfa|2fa/.test(t)) return "privilege";
  if (/sql|injection|xss|script|command|rce|deserial|eval\(|exec\(|ssrf/.test(t)) return "execution";
  if (/crypto|tls|ssl|encrypt|certificate|pii|leak|exposure|sensitive/.test(t)) return "data";
  if (/port|network|dns|firewall|scan|fingerprint|banner|exposure/.test(t)) return "recon";
  if (/ddos|denial|availability|crash|dos|resource exhaustion/.test(t)) return "impact";
  return "initial";
}

function isAcceptedRisk(f: AttackPathFindingInput): boolean {
  return (f.status ?? "").toLowerCase() === "accepted-risk";
}

function isResolvedLike(f: AttackPathFindingInput): boolean {
  const s = (f.status ?? "").toUpperCase().trim();
  return s === "RESOLVED";
}

export type BuildAttackPathGraphOptions = {
  /** If false, only include open / in-progress findings */
  includeResolved?: boolean;
  /** Include accepted-risk findings as nodes */
  includeAcceptedRisk?: boolean;
};

/**
 * Builds a directed graph: START → each non-empty PHASE → FINDING nodes.
 * Backbone edges also connect consecutive phases that have at least one finding (path narrative).
 */
export function buildAttackPathGraph(
  findings: AttackPathFindingInput[],
  options: BuildAttackPathGraphOptions = {},
): { nodes: AttackPathNode[]; edges: AttackPathEdge[] } {
  const includeResolved = options.includeResolved ?? false;
  const includeAcceptedRisk = options.includeAcceptedRisk ?? true;

  const filtered = findings.filter((f) => {
    if (!includeResolved && isResolvedLike(f)) return false;
    if (!includeAcceptedRisk && isAcceptedRisk(f)) return false;
    return true;
  });

  const nodes: AttackPathNode[] = [];
  const edges: AttackPathEdge[] = [];

  const START_ID = "node-start";
  if (filtered.length === 0) {
    nodes.push({ id: START_ID, kind: "start", label: "Threat landscape" });
    return { nodes, edges };
  }

  nodes.push({ id: START_ID, kind: "start", label: "Threat landscape" });

  const byPhase = new Map<AttackPhaseId, AttackPathFindingInput[]>();
  for (const p of ATTACK_PHASES) byPhase.set(p.id, []);

  for (const f of filtered) {
    const phase = classifyAttackPhase(f);
    byPhase.get(phase)!.push(f);
  }

  const activePhases = ATTACK_PHASES.filter((p) => (byPhase.get(p.id) ?? []).length > 0);
  const phaseNodeIds = new Map<AttackPhaseId, string>();

  for (const p of ATTACK_PHASES) {
    const list = byPhase.get(p.id) ?? [];
    const pid = `phase-${p.id}`;
    phaseNodeIds.set(p.id, pid);
    nodes.push({
      id: pid,
      kind: "phase",
      label: p.label,
      phaseId: p.id,
    });
    if (list.length > 0) {
      edges.push({ from: START_ID, to: pid });
    }
  }

  for (let i = 0; i < activePhases.length - 1; i++) {
    const a = phaseNodeIds.get(activePhases[i]!.id)!;
    const b = phaseNodeIds.get(activePhases[i + 1]!.id)!;
    edges.push({ from: a, to: b });
  }

  for (const p of ATTACK_PHASES) {
    const list = byPhase.get(p.id) ?? [];
    const pid = phaseNodeIds.get(p.id)!;
    for (const f of list) {
      const fid = `finding-${f.id}`;
      const shortTitle = f.title.length > 42 ? `${f.title.slice(0, 40)}…` : f.title;
      nodes.push({
        id: fid,
        kind: "finding",
        label: shortTitle,
        phaseId: p.id,
        findingId: f.id,
        severity: f.severity,
      });
      edges.push({ from: pid, to: fid });
    }
  }

  return { nodes, edges };
}
