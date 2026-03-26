import * as vscode from "vscode";
import type { ApiFinding } from "./api";
import { scanDetailUrl } from "./api";

export const SECRET_KEY = "aithonShield.apiKey";

const SEVERITY_ORDER: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

function severitySort(a: ApiFinding, b: ApiFinding): number {
  const da = SEVERITY_ORDER[a.severity?.toUpperCase() ?? ""] ?? 99;
  const db = SEVERITY_ORDER[b.severity?.toUpperCase() ?? ""] ?? 99;
  if (da !== db) return da - db;
  return a.title.localeCompare(b.title);
}

export type FindingTreeElement = FindingItem | vscode.TreeItem;

export class FindingsTreeProvider implements vscode.TreeDataProvider<FindingTreeElement> {
  private _onDidChange = new vscode.EventEmitter<FindingTreeElement | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  private findings: ApiFinding[] = [];
  private loadError: string | null = null;

  constructor(
    private readonly getBaseUrl: () => string,
    private readonly loadFn: () => Promise<ApiFinding[]>,
  ) {}

  refresh(): void {
    this.loadError = null;
    this._onDidChange.fire();
  }

  setError(message: string): void {
    this.loadError = message;
    this.findings = [];
    this._onDidChange.fire();
  }

  async load(): Promise<void> {
    try {
      this.findings = (await this.loadFn()).filter((f) => !isResolvedStatus(f.status));
      this.findings.sort(severitySort);
      this.loadError = null;
    } catch (e) {
      this.findings = [];
      this.loadError = e instanceof Error ? e.message : String(e);
    }
    this._onDidChange.fire();
  }

  getTreeItem(element: FindingTreeElement): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<FindingTreeElement[]> {
    const baseUrl = this.getBaseUrl();
    if (this.loadError) {
      const msg = new vscode.TreeItem(this.loadError, vscode.TreeItemCollapsibleState.None);
      msg.iconPath = new vscode.ThemeIcon("error");
      msg.tooltip = this.loadError;
      return [msg];
    }
    if (this.findings.length === 0) {
      const msg = new vscode.TreeItem(
        "No open findings — refresh after scans, or set API key.",
        vscode.TreeItemCollapsibleState.None,
      );
      msg.iconPath = new vscode.ThemeIcon("info");
      return [msg];
    }
    return this.findings.map((f) => new FindingItem(f, baseUrl));
  }
}

function isResolvedStatus(status: string): boolean {
  const s = status.toLowerCase();
  return s === "resolved" || s === "fixed";
}

export class FindingItem extends vscode.TreeItem {
  readonly finding: ApiFinding;

  constructor(finding: ApiFinding, baseUrl: string) {
    const label = finding.title.length > 64 ? `${finding.title.slice(0, 61)}…` : finding.title;
    super(label, vscode.TreeItemCollapsibleState.None);
    this.finding = finding;
    this.description = `${finding.severity} · ${finding.category}`;
    this.tooltip = new vscode.MarkdownString(
      `**${finding.title}**\n\n${finding.category} · ${finding.severity}\n\n${finding.location ?? ""}`,
    );
    this.iconPath = severityIcon(finding.severity);

    const st = finding.scanType ?? "";
    const sid = finding.scanId ?? "";
    if (st && sid) {
      this.command = {
        command: "vscode.open",
        title: "Open scan in browser",
        arguments: [vscode.Uri.parse(scanDetailUrl(baseUrl, st, sid))],
      };
    }

    const open = !isResolvedStatus(finding.status);
    this.contextValue = open ? "findingOpen" : "findingResolved";
  }
}

function severityIcon(severity: string): vscode.ThemeIcon {
  const s = severity.toUpperCase();
  if (s === "CRITICAL") return new vscode.ThemeIcon("error");
  if (s === "HIGH") return new vscode.ThemeIcon("warning");
  if (s === "MEDIUM") return new vscode.ThemeIcon("issues");
  return new vscode.ThemeIcon("shield");
}
