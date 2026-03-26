import { useCallback, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  buildAttackPathGraph,
  ATTACK_PHASES,
  type AttackPathNode,
  type AttackPathEdge,
  type AttackPhaseId,
} from "@shared/attackPathGraphModel";
import type { Finding } from "@shared/schema";
import type { FixConfidencePayload } from "@shared/fixConfidence";
import { ZoomIn, ZoomOut, Maximize2, GitBranch, ExternalLink } from "lucide-react";
import { useLocation } from "wouter";

type FindingRow = Finding & { fixConfidence?: FixConfidencePayload; scanName?: string };

const PHASE_COL = 200;
const FINDING_COL = 520;
const START_COL = 48;
/** Vertical distance between finding row centers — must be ≥ node graphic height so rows never overlap */
const FINDING_ROW_STEP = 52;
const BETWEEN_PHASE_BLOCKS = 28;
/** Empty phase row when “show all phases” includes phases with zero findings */
const EMPTY_PHASE_ROW_STEP = 72;
const NODE_R = 14;
const PHASE_W = 160;
const PHASE_H = 44;
const FINDING_BOX_H = 40;

type Pos = { x: number; y: number; w?: number; h?: number };

/**
 * Waterfall layout: findings are a single non-overlapping column; each phase sits at the
 * vertical midpoint of its findings block (or on its own row if empty).
 */
function layoutNodes(nodes: AttackPathNode[], _edges: AttackPathEdge[]): Map<string, Pos> {
  const m = new Map<string, Pos>();
  const start = nodes.find((n) => n.kind === "start");

  let rowCenterY = 56;

  ATTACK_PHASES.forEach((p) => {
    const pn = nodes.find((n) => n.kind === "phase" && n.phaseId === p.id);
    if (!pn) return;

    const findings = nodes
      .filter((n) => n.kind === "finding" && n.phaseId === p.id)
      .sort((a, b) => (a.findingId ?? "").localeCompare(b.findingId ?? ""));

    if (findings.length === 0) {
      m.set(pn.id, { x: PHASE_COL, y: rowCenterY, w: PHASE_W, h: PHASE_H });
      rowCenterY += EMPTY_PHASE_ROW_STEP;
      return;
    }

    const firstCenterY = rowCenterY;
    findings.forEach((f) => {
      m.set(f.id, { x: FINDING_COL, y: rowCenterY, w: 220, h: FINDING_BOX_H });
      rowCenterY += FINDING_ROW_STEP;
    });
    const lastCenterY = rowCenterY - FINDING_ROW_STEP;
    const phaseCenterY = (firstCenterY + lastCenterY) / 2;
    m.set(pn.id, { x: PHASE_COL, y: phaseCenterY, w: PHASE_W, h: PHASE_H });

    rowCenterY += BETWEEN_PHASE_BLOCKS;
  });

  if (start) {
    let minY = Infinity;
    let maxY = -Infinity;
    for (const pos of m.values()) {
      const half = (pos.h ?? FINDING_BOX_H) / 2;
      minY = Math.min(minY, pos.y - half);
      maxY = Math.max(maxY, pos.y + half);
    }
    if (!Number.isFinite(minY)) {
      minY = 56;
      maxY = 200;
    }
    m.set(start.id, { x: START_COL, y: (minY + maxY) / 2, w: 36, h: 36 });
  }

  return m;
}

function computeSvgContentHeight(positions: Map<string, Pos>): number {
  let max = 400;
  for (const p of positions.values()) {
    const half = (p.h ?? FINDING_BOX_H) / 2;
    max = Math.max(max, p.y + half + 64);
  }
  return max;
}

function severityStroke(sev: string | undefined): string {
  const s = (sev ?? "").toLowerCase();
  if (s === "critical") return "rgb(220 38 38)";
  if (s === "high") return "rgb(234 88 12)";
  if (s === "medium") return "rgb(202 138 4)";
  if (s === "low") return "rgb(59 130 246)";
  return "rgb(113 113 122)";
}

export default function AttackPathGraphPage() {
  const [, setLocation] = useLocation();
  const [includeResolved, setIncludeResolved] = useState(false);
  const [showAllPhases, setShowAllPhases] = useState(false);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: findings, isPending, isError, error } = useQuery<FindingRow[]>({
    queryKey: ["/api/findings"],
  });

  const { nodes, edges, positions, svgContentHeight } = useMemo(() => {
    const list = findings ?? [];
    const { nodes: n, edges: e } = buildAttackPathGraph(
      list.map((f) => ({
        id: f.id,
        title: f.title,
        category: f.category,
        severity: f.severity,
        asset: f.asset,
        cwe: f.cwe,
        status: f.status,
        scanType: f.scanType,
      })),
      { includeResolved, includeAcceptedRisk: true },
    );

    let nodesFiltered = n;
    if (!showAllPhases) {
      const phaseHasFinding = new Set<AttackPhaseId>();
      for (const node of n) {
        if (node.kind === "finding" && node.phaseId) phaseHasFinding.add(node.phaseId);
      }
      nodesFiltered = n.filter((node) => {
        if (node.kind === "phase" && node.phaseId && !phaseHasFinding.has(node.phaseId)) return false;
        return true;
      });
      const keep = new Set(nodesFiltered.map((x) => x.id));
      const edgesFiltered = e.filter((ed) => keep.has(ed.from) && keep.has(ed.to));
      const pos = layoutNodes(nodesFiltered, edgesFiltered);
      const h = computeSvgContentHeight(pos);
      return { nodes: nodesFiltered, edges: edgesFiltered, positions: pos, svgContentHeight: h };
    }

    const pos = layoutNodes(n, e);
    const h = computeSvgContentHeight(pos);
    return { nodes: n, edges: e, positions: pos, svgContentHeight: h };
  }, [findings, includeResolved, showAllPhases]);

  const selectedFinding = useMemo(() => {
    if (!selectedId || !findings) return null;
    const node = nodes.find((x) => x.id === selectedId);
    if (!node?.findingId) return null;
    return findings.find((f) => f.id === node.findingId) ?? null;
  }, [selectedId, nodes, findings]);

  const onWheel = useCallback((ev: React.WheelEvent<SVGSVGElement>) => {
    ev.preventDefault();
    const delta = ev.deltaY > 0 ? -0.08 : 0.08;
    setScale((s) => Math.min(2.2, Math.max(0.45, s + delta)));
  }, []);

  const onMouseDownBg = (ev: React.MouseEvent) => {
    if ((ev.target as SVGElement).closest("[data-node]")) return;
    dragRef.current = { x: ev.clientX, y: ev.clientY, px: pan.x, py: pan.y };
    setSelectedId(null);
  };

  const onMouseMove = (ev: React.MouseEvent) => {
    if (!dragRef.current) return;
    setPan({
      x: dragRef.current.px + (ev.clientX - dragRef.current.x),
      y: dragRef.current.py + (ev.clientY - dragRef.current.y),
    });
  };

  const onMouseUp = () => {
    dragRef.current = null;
  };

  const edgeEndpoints = (from: string, to: string): [number, number, number, number] | null => {
    const a = positions.get(from);
    const b = positions.get(to);
    const na = nodes.find((n) => n.id === from);
    const nb = nodes.find((n) => n.id === to);
    if (!a || !b || !na || !nb) return null;
    const center = (n: AttackPathNode, p: Pos): [number, number] => {
      if (n.kind === "start" || n.kind === "phase") return [p.x, p.y];
      const w = p.w ?? 200;
      return [p.x + w / 2, p.y];
    };
    const [ax, ay] = center(na, a);
    const [bx, by] = center(nb, b);
    return [ax, ay, bx, by];
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <GitBranch className="h-8 w-8 text-primary" />
            Attack path graph
          </h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base max-w-2xl">
            Interactive view of how open findings cluster across attack phases (heuristic mapping from title, category, and CWE). Drag the canvas to pan, scroll to zoom, click a finding for details.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 shrink-0">
          <div className="flex items-center gap-2">
            <Switch id="inc-res" checked={includeResolved} onCheckedChange={setIncludeResolved} data-testid="switch-include-resolved" />
            <Label htmlFor="inc-res" className="text-sm">Include resolved</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="all-ph" checked={showAllPhases} onCheckedChange={setShowAllPhases} data-testid="switch-all-phases" />
            <Label htmlFor="all-ph" className="text-sm">Show empty phases</Label>
          </div>
          <div className="flex gap-1 border rounded-md p-1">
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setScale((s) => Math.min(2.2, s + 0.15))} aria-label="Zoom in">
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setScale((s) => Math.max(0.45, s - 0.15))} aria-label="Zoom out">
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setScale(1); setPan({ x: 0, y: 0 }); }} aria-label="Reset view">
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
        <Card className="overflow-hidden border-border/60">
          {isPending && <Skeleton className="h-[520px] w-full rounded-none" />}
          {isError && (
            <div className="p-6 text-sm text-destructive">
              {error instanceof Error ? error.message : String(error)}
            </div>
          )}
          {!isPending && !isError && (
            <div
              className="relative bg-muted/20 max-h-[min(88vh,960px)] overflow-auto"
              data-testid="attack-path-canvas-wrap"
            >
              <svg
                className="cursor-grab active:cursor-grabbing touch-none block max-w-full"
                width={780}
                height={svgContentHeight}
                onWheel={onWheel}
                onMouseDown={onMouseDownBg}
                onMouseMove={onMouseMove}
                onMouseLeave={onMouseUp}
                onMouseUp={onMouseUp}
                role="img"
                aria-label="Attack path graph canvas"
              >
                <defs>
                  <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" className="fill-muted-foreground/50" />
                  </marker>
                </defs>
                <g transform={`translate(${pan.x},${pan.y}) scale(${scale})`}>
                  {edges.map((ed, i) => {
                    const seg = edgeEndpoints(ed.from, ed.to);
                    if (!seg) return null;
                    const [x1, y1, x2, y2] = seg;
                    return (
                      <line
                        key={`${ed.from}-${ed.to}-${i}`}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke="currentColor"
                        className="text-border"
                        strokeWidth={1.5}
                        markerEnd="url(#arrowhead)"
                      />
                    );
                  })}
                  {nodes.map((node) => {
                    const p = positions.get(node.id);
                    if (!p) return null;
                    if (node.kind === "start") {
                      return (
                        <g
                          key={node.id}
                          data-node
                          className="cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); setSelectedId(node.id); }}
                        >
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r={NODE_R + 4}
                            className={selectedId === node.id ? "fill-primary stroke-primary" : "fill-primary/20 stroke-primary/60"}
                            strokeWidth={2}
                          />
                          <text x={p.x} y={p.y + 4} textAnchor="middle" className="fill-primary text-[11px] font-bold pointer-events-none">
                            ▶
                          </text>
                          <text x={p.x} y={p.y + 52} textAnchor="middle" className="fill-foreground text-[10px] font-medium pointer-events-none">
                            Start
                          </text>
                        </g>
                      );
                    }
                    if (node.kind === "phase") {
                      const active = nodes.some((n) => n.kind === "finding" && n.phaseId === node.phaseId);
                      return (
                        <g key={node.id} data-node onClick={(e) => e.stopPropagation()}>
                          <rect
                            x={p.x - PHASE_W / 2}
                            y={p.y - PHASE_H / 2}
                            width={PHASE_W}
                            height={PHASE_H}
                            rx={8}
                            className={
                              active
                                ? "fill-card stroke-primary/50 stroke-2"
                                : "fill-muted/40 stroke-border stroke-1"
                            }
                          />
                          <text
                            x={p.x}
                            y={p.y + 4}
                            textAnchor="middle"
                            className="fill-foreground text-[11px] font-semibold pointer-events-none"
                          >
                            {node.label.length > 22 ? `${node.label.slice(0, 20)}…` : node.label}
                          </text>
                        </g>
                      );
                    }
                    const sel = selectedId === node.id;
                    return (
                      <g
                        key={node.id}
                        data-node
                        className="cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(node.id);
                        }}
                      >
                        <rect
                          x={p.x}
                          y={p.y - FINDING_BOX_H / 2}
                          width={p.w ?? 200}
                          height={FINDING_BOX_H}
                          rx={6}
                          className={sel ? "fill-accent stroke-primary stroke-2" : "fill-background stroke-border"}
                          strokeWidth={sel ? 2 : 1}
                        />
                        <line
                          x1={p.x}
                          y1={p.y - FINDING_BOX_H / 2}
                          x2={p.x + 4}
                          y2={p.y + FINDING_BOX_H / 2}
                          stroke={severityStroke(node.severity)}
                          strokeWidth={4}
                        />
                        <text
                          x={p.x + 14}
                          y={p.y + 4}
                          className="fill-foreground text-[10px] pointer-events-none"
                        >
                          {node.label}
                        </text>
                      </g>
                    );
                  })}
                </g>
              </svg>
              <p className="absolute bottom-2 left-3 text-[10px] text-muted-foreground pointer-events-none">
                Drag background to pan · Wheel to zoom · Edges are illustrative (heuristic phases)
              </p>
            </div>
          )}
        </Card>

        <Card className="p-4 border-border/60 h-[min(88vh,960px)] flex flex-col">
          <h2 className="text-sm font-semibold mb-2">Selection</h2>
          {!selectedFinding && (
            <p className="text-xs text-muted-foreground">
              Click a finding node on the graph to see title, severity, and a shortcut to the Findings table.
            </p>
          )}
          {selectedFinding && (
            <ScrollArea className="flex-1 pr-3">
              <div className="space-y-2 text-sm">
                <Badge variant="outline" className="text-xs uppercase">
                  {selectedFinding.severity}
                </Badge>
                <p className="font-medium leading-snug">{selectedFinding.title}</p>
                <p className="text-xs text-muted-foreground">{selectedFinding.category}</p>
                {selectedFinding.asset && (
                  <p className="text-xs">
                    <span className="text-muted-foreground">Asset:</span> {selectedFinding.asset}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">CWE {selectedFinding.cwe}</p>
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-full mt-2"
                  onClick={() => setLocation("/findings")}
                  data-testid="button-open-findings"
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-2" />
                  Open Findings
                </Button>
              </div>
            </ScrollArea>
          )}
        </Card>
      </div>
    </div>
  );
}
