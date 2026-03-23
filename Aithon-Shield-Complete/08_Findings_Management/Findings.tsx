import { FindingsTable } from "@/components/FindingsTable";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GlobalFixDialog } from "@/components/GlobalFixDialog";
import { GlobalFixProgressDialog } from "@/components/GlobalFixProgressDialog";
import { Search, Zap } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Finding } from "@shared/schema";
import { isFindingResolved } from "@/lib/findings";

// P1-P5 priority tier — driven by severity
function getPriorityTier(severity: string | null | undefined): string {
  const s = (severity ?? "").toLowerCase();
  if (s === "critical") return "P1";
  if (s === "high")     return "P2";
  if (s === "medium")   return "P3";
  if (s === "low")      return "P4";
  return "P5";
}

export default function Findings() {
  const [location, setLocation] = useLocation();
  const [severity, setSeverity] = useState("all");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [globalFixOpen, setGlobalFixOpen] = useState(false);
  const [globalFixJobId, setGlobalFixJobId] = useState<string | null>(null);
  const [globalFixProgressOpen, setGlobalFixProgressOpen] = useState(false);

  useEffect(() => {
    const searchParams = location.split("?")[1] ?? "";
    const params = new URLSearchParams(searchParams);
    const severityParam = params.get("severity");
    const statusParam = params.get("status");
    const priorityParam = params.get("priority");
    const searchParam = params.get("search");
    
    // Reset to defaults when parameters are absent
    setSeverity(severityParam || "all");
    setStatus(statusParam || "all");
    setPriority(priorityParam || "all");
    setSearchQuery(searchParam || "");
  }, [location]);

  // Update URL when filters change
  const updateURL = (newSeverity?: string, newStatus?: string, newPriority?: string, newSearch?: string) => {
    const params = new URLSearchParams();
    const sev = newSeverity !== undefined ? newSeverity : severity;
    const stat = newStatus !== undefined ? newStatus : status;
    const pri = newPriority !== undefined ? newPriority : priority;
    const search = newSearch !== undefined ? newSearch : searchQuery;

    if (sev !== "all") params.set("severity", sev);
    if (stat !== "all") params.set("status", stat);
    if (pri !== "all") params.set("priority", pri);
    if (search) params.set("search", search);

    const queryString = params.toString();
    setLocation(`/findings${queryString ? `?${queryString}` : ""}`);
  };

  const handleSeverityChange = (value: string) => {
    setSeverity(value);
    updateURL(value, undefined, undefined, undefined);
  };

  const handleStatusChange = (value: string) => {
    setStatus(value);
    updateURL(undefined, value, undefined, undefined);
  };

  const handlePriorityChange = (value: string) => {
    setPriority(value);
    updateURL(undefined, undefined, value, undefined);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (value === "") {
      updateURL(undefined, undefined, undefined, "");
    }
  };

  const { data: findings, isLoading } = useQuery<Finding[]>({
    queryKey: ["/api/findings"],
  });

  const handleGlobalFixSuccess = (jobId: string) => {
    setGlobalFixJobId(jobId);
    setGlobalFixProgressOpen(true);
  };

  // Count unresolved findings
  const unresolvedFindings = findings?.filter(f => !isFindingResolved(f)) || [];
  const hasUnresolvedIssues = unresolvedFindings.length > 0;

  const filteredFindings = findings?.filter((finding) => {
    const scanName = (finding as any).scanName || "";
    const matchesSearch = finding.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      finding.asset.toLowerCase().includes(searchQuery.toLowerCase()) ||
      scanName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSeverity = severity === "all" || finding.severity.toLowerCase() === severity.toLowerCase();
    const matchesStatus = status === "all" || finding.status.toLowerCase() === status.toLowerCase();
    const findingPriorityTier = getPriorityTier(finding.severity);
    const matchesPriority = priority === "all" || findingPriorityTier === priority;
    return matchesSearch && matchesSeverity && matchesStatus && matchesPriority;
  }) || [];

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Security Findings</h1>
        <p className="text-muted-foreground mt-1 text-sm md:text-base">
          View and manage all security vulnerabilities
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search findings or scan name..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            data-testid="input-search-findings"
          />
        </div>
        <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-4 flex-wrap">
          <Select value={severity} onValueChange={handleSeverityChange}>
            <SelectTrigger className="w-full sm:w-[160px]" data-testid="select-severity">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-full sm:w-[160px]" data-testid="select-status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priority} onValueChange={handlePriorityChange}>
            <SelectTrigger className="w-full sm:w-[160px]" data-testid="select-priority">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="P1">P1 — Critical (85-100)</SelectItem>
              <SelectItem value="P2">P2 — High (70-84)</SelectItem>
              <SelectItem value="P3">P3 — Medium (50-69)</SelectItem>
              <SelectItem value="P4">P4 — Low (25-49)</SelectItem>
              <SelectItem value="P5">P5 — Minimal (0-24)</SelectItem>
            </SelectContent>
          </Select>
          {hasUnresolvedIssues && (
            <Button
              size="default"
              onClick={() => setGlobalFixOpen(true)}
              className="bg-yellow-600 hover:bg-yellow-700 text-white whitespace-nowrap"
              data-testid="button-fix-all-findings"
            >
              <Zap className="w-4 h-4 mr-2" />
              Fix All ({unresolvedFindings.length})
            </Button>
          )}
        </div>
      </div>

      <GlobalFixDialog
        open={globalFixOpen}
        onOpenChange={setGlobalFixOpen}
        onSuccess={handleGlobalFixSuccess}
      />
      {globalFixJobId && (
        <GlobalFixProgressDialog
          open={globalFixProgressOpen}
          onOpenChange={setGlobalFixProgressOpen}
          jobId={globalFixJobId}
        />
      )}

      <FindingsTable findings={filteredFindings} isLoading={isLoading} />
    </div>
  );
}
