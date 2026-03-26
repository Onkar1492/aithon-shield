/**
 * Infrastructure-as-code heuristic checks (Terraform, Docker, K8s YAML, compose).
 * Not a full Checkov/tfsec replacement; focused high-signal patterns for alert fatigue reduction.
 */
import * as fs from "fs/promises";
import * as path from "path";
import type { ProgressCallback, Vulnerability } from "./types";

const MAX_FILE_BYTES = 600_000;
const MAX_IAC_FILES = 800;

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "out",
  "coverage",
  "vendor",
  "__pycache__",
  ".venv",
  "venv",
  "target",
  ".cargo",
  "Pods",
  "bower_components",
  ".turbo",
  ".cache",
]);

const YAML_DIR_HINTS = new Set([
  "k8s",
  "kubernetes",
  "helm",
  "charts",
  "deploy",
  "infra",
  "iac",
  "manifests",
  "kube",
  "terraform",
  "aws",
  "gcp",
  "azure",
]);

function shouldScanYamlRel(relativePosix: string): boolean {
  const lower = relativePosix.toLowerCase();
  const base = path.posix.basename(lower);
  if (base === "template.yaml" || base === "template.yml") return true;
  if (base.startsWith("cloudformation") && (base.endsWith(".yml") || base.endsWith(".yaml"))) return true;
  if (base === "values.yaml" || base === "values.yml") return true;
  if (base === "chart.yaml") return false;
  if (/^docker-compose/.test(base) || base === "compose.yaml" || base === "compose.yml") return true;
  const segments = lower.split("/");
  return segments.some((s) => YAML_DIR_HINTS.has(s));
}

function iacFileFilter(abs: string, repoPath: string): boolean {
  const rel = path.relative(repoPath, abs).split(path.sep).join("/");
  if (rel.startsWith(".") || rel.includes("/.")) return false;
  const base = path.basename(abs);
  const lower = base.toLowerCase();
  const ext = path.extname(lower);

  if (ext === ".tf" || lower.endsWith(".tf.json")) return true;
  if (lower === "dockerfile" || lower.endsWith(".dockerfile")) return true;
  if (/^docker-compose.*\.ya?ml$/i.test(base) || lower === "compose.yaml" || lower === "compose.yml") return true;
  if (ext === ".yaml" || ext === ".yml") return shouldScanYamlRel(rel);
  return false;
}

async function collectIacFiles(repoPath: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string): Promise<void> {
    if (out.length >= MAX_IAC_FILES) return;
    let entries: import("fs").Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (out.length >= MAX_IAC_FILES) break;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue;
        await walk(full);
      } else if (e.isFile() && iacFileFilter(full, repoPath)) {
        out.push(full);
      }
    }
  }
  await walk(repoPath);
  return out;
}

function sev(
  level: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
): Pick<Vulnerability, "severity" | "riskScore" | "exploitabilityScore" | "impactScore"> {
  const map = {
    CRITICAL: { riskScore: 95, exploitabilityScore: 90, impactScore: 95 },
    HIGH: { riskScore: 80, exploitabilityScore: 75, impactScore: 80 },
    MEDIUM: { riskScore: 55, exploitabilityScore: 50, impactScore: 55 },
    LOW: { riskScore: 35, exploitabilityScore: 30, impactScore: 35 },
  } as const;
  return { severity: level, ...map[level] };
}

function vuln(
  partial: Omit<Vulnerability, "category" | "aiSuggestion"> & { aiSuggestion?: string },
): Vulnerability {
  return {
    ...partial,
    category: "Infrastructure as Code",
    aiSuggestion: partial.aiSuggestion ?? partial.remediation,
  };
}

function scanTerraformLines(
  lines: string[],
  relativePath: string,
  out: Vulnerability[],
): void {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const n = i + 1;
    if (
      /0\.0\.0\.0\/0/.test(line) &&
      /cidr|ingress|security_group|firewall|allowed|source|prefix_list/i.test(line)
    ) {
      out.push(
        vuln({
          title: "Terraform: overly permissive network CIDR (0.0.0.0/0)",
          description: `Line ${n}: inbound or CIDR rule may expose services to the entire internet.\n\nSnippet: ${line.trim().slice(0, 200)}`,
          ...sev("HIGH"),
          cwe: "284",
          location: `${relativePath}:${n}`,
          remediation:
            "Restrict source CIDRs to known IPs, VPN ranges, or security group references. Prefer private subnets for internal services.",
        }),
      );
    }
    if (/publicly_accessible\s*=\s*true/i.test(line)) {
      out.push(
        vuln({
          title: "Terraform: database or instance marked publicly accessible",
          description: `Line ${n}: publicly_accessible is true — data stores may be reachable from the internet.\n\nSnippet: ${line.trim().slice(0, 200)}`,
          ...sev("HIGH"),
          cwe: "200",
          location: `${relativePath}:${n}`,
          remediation: "Set publicly_accessible = false and require private connectivity (VPC, peering, or managed private endpoints).",
        }),
      );
    }
    if (/\bencrypted\s*=\s*false\b/i.test(line) && /volume|disk|ebs|storage/i.test(line + lines[i + 1] || "")) {
      out.push(
        vuln({
          title: "Terraform: storage encryption disabled",
          description: `Line ${n}: block or object storage may be unencrypted at rest.\n\nSnippet: ${line.trim().slice(0, 200)}`,
          ...sev("MEDIUM"),
          cwe: "311",
          location: `${relativePath}:${n}`,
          remediation: "Enable encryption at rest (default KMS or customer-managed keys) for volumes and buckets.",
        }),
      );
    }
  }
}

function scanDockerfileLines(lines: string[], relativePath: string, out: Vulnerability[]): void {
  let lastUserLine = -1;
  let lastUserIsRoot = false;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    const trimmed = raw.trim();
    if (/^USER\s+/i.test(trimmed)) {
      lastUserLine = i + 1;
      lastUserIsRoot = /^USER\s+root\s*$/i.test(trimmed);
    }
  }
  if (lastUserIsRoot && lastUserLine > 0) {
    out.push(
      vuln({
        title: "Dockerfile: container runs as root",
        description: `Line ${lastUserLine}: final USER is root — processes in the container run with UID 0, increasing blast radius if the workload is compromised.`,
        ...sev("MEDIUM"),
        cwe: "250",
        location: `${relativePath}:${lastUserLine}`,
        remediation: "Add a non-root USER (and ensure the image has a suitable uid/gid), or use a hardened base that drops privileges.",
      }),
    );
  }
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i]!.trim();
    const n = i + 1;
    if (/^ADD\s+https?:\/\//i.test(trimmed)) {
      out.push(
        vuln({
          title: "Dockerfile: ADD fetches remote URL",
          description: `Line ${n}: ADD with http(s) URL can pull mutable remote content into the image (supply-chain / integrity risk).`,
          ...sev("HIGH"),
          cwe: "829",
          location: `${relativePath}:${n}`,
          remediation: "Prefer COPY from checked-in artifacts or multi-stage builds with pinned digests; if you must download, verify checksums in a RUN step.",
        }),
      );
    }
  }
}

function scanK8sOrComposeLines(lines: string[], relativePath: string, out: Vulnerability[]): void {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const n = i + 1;
    const t = line.trim();
    if (/privileged:\s*true\b/i.test(t)) {
      out.push(
        vuln({
          title: "Kubernetes/compose: privileged container",
          description: `Line ${n}: privileged: true grants host-level capabilities to the container.`,
          ...sev("HIGH"),
          cwe: "250",
          location: `${relativePath}:${n}`,
          remediation: "Remove privileged mode; use securityContext capabilities drop, readOnlyRootFilesystem, and minimal required syscalls.",
        }),
      );
    }
    if (/hostNetwork:\s*true\b/i.test(t)) {
      out.push(
        vuln({
          title: "Kubernetes: hostNetwork enabled",
          description: `Line ${n}: Pod uses the host network namespace, weakening network isolation.`,
          ...sev("MEDIUM"),
          cwe: "693",
          location: `${relativePath}:${n}`,
          remediation: "Disable hostNetwork unless strictly required; use Services and NetworkPolicies instead.",
        }),
      );
    }
    if (/allowPrivilegeEscalation:\s*true\b/i.test(t)) {
      out.push(
        vuln({
          title: "Kubernetes: allowPrivilegeEscalation true",
          description: `Line ${n}: processes may gain additional privileges via setuid or similar.`,
          ...sev("MEDIUM"),
          cwe: "250",
          location: `${relativePath}:${n}`,
          remediation: "Set allowPrivilegeEscalation: false where compatible with the workload.",
        }),
      );
    }
    if (/runAsUser:\s*0\b/.test(t) || /runAsUser:\s*["']?0["']?\s*$/.test(t)) {
      out.push(
        vuln({
          title: "Kubernetes: container runs as UID 0",
          description: `Line ${n}: securityContext.runAsUser is 0 (root in many images).`,
          ...sev("MEDIUM"),
          cwe: "250",
          location: `${relativePath}:${n}`,
          remediation: "Use a non-zero runAsUser and ensure the image supports it (fs permissions, etc.).",
        }),
      );
    }
    if (/network_mode:\s*["']?host["']?\s*$/i.test(t)) {
      out.push(
        vuln({
          title: "Docker Compose: network_mode host",
          description: `Line ${n}: service uses host networking, reducing isolation between container and host.`,
          ...sev("MEDIUM"),
          cwe: "693",
          location: `${relativePath}:${n}`,
          remediation: "Use bridge networks and published ports instead of host mode unless necessary.",
        }),
      );
    }
  }
}

export async function performIaCScan(
  repoPath: string,
  progressCallback?: ProgressCallback,
): Promise<Vulnerability[]> {
  if (progressCallback) {
    await progressCallback(0, "Discovering IaC files...");
  }
  const files = await collectIacFiles(repoPath);
  const findings: Vulnerability[] = [];
  const total = Math.max(files.length, 1);

  for (let i = 0; i < files.length; i++) {
    const abs = files[i]!;
    const relativePath = path.relative(repoPath, abs).split(path.sep).join("/");
    if (progressCallback) {
      await progressCallback(Math.floor(((i + 1) / total) * 100), `IaC: ${relativePath}`);
    }
    let st: import("fs").Stats;
    try {
      st = await fs.stat(abs);
    } catch {
      continue;
    }
    if (!st.isFile() || st.size > MAX_FILE_BYTES) continue;
    let content: string;
    try {
      content = await fs.readFile(abs, "utf-8");
    } catch {
      continue;
    }
    const lines = content.split(/\r?\n/);
    const lower = relativePath.toLowerCase();
    if (lower.endsWith(".tf") || lower.endsWith(".tf.json")) {
      scanTerraformLines(lines, relativePath, findings);
    } else if (/dockerfile$|\.dockerfile$/i.test(lower)) {
      scanDockerfileLines(lines, relativePath, findings);
    } else {
      scanK8sOrComposeLines(lines, relativePath, findings);
    }
    if (/AKIA[0-9A-Z]{16}/.test(content)) {
      findings.push(
        vuln({
          title: "IaC: possible AWS access key embedded in file",
          description: `An AKIA… pattern appears in ${relativePath}. Rotate the credential if real; never commit long-lived keys to IaC.`,
          ...sev("CRITICAL"),
          cwe: "798",
          location: `${relativePath}:1`,
          remediation:
            "Remove the key from version control, rotate it in IAM, and load secrets from a vault or CI/CD secret store at apply time.",
        }),
      );
    }
  }

  if (progressCallback) {
    await progressCallback(100, `IaC scan complete (${files.length} files, ${findings.length} findings)`);
  }
  return findings;
}
