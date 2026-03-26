/**
 * Container image layer analysis via OCI/Distribution registry HTTP API (manifest + layer metadata).
 * No local Docker daemon required. Docker Hub supported; custom registries: best-effort anonymous v2.
 */
const FETCH_TIMEOUT_MS = 28_000;

const ACCEPT_MANIFEST =
  "application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.oci.image.index.v1+json";

export type ContainerScanInput = {
  imageName: string;
  imageTag: string;
  registry: string;
  registryUrl: string | null | undefined;
};

export type LayerFinding = {
  title: string;
  description: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  category: string;
  cwe: string;
  location: string;
  remediation: string;
  aiSuggestion: string;
  riskScore: number;
  exploitabilityScore: number;
  impactScore: number;
};

function scoresFor(sev: LayerFinding["severity"]): Pick<LayerFinding, "riskScore" | "exploitabilityScore" | "impactScore"> {
  const m = {
    CRITICAL: { riskScore: 95, exploitabilityScore: 85, impactScore: 95 },
    HIGH: { riskScore: 78, exploitabilityScore: 72, impactScore: 78 },
    MEDIUM: { riskScore: 52, exploitabilityScore: 48, impactScore: 52 },
    LOW: { riskScore: 28, exploitabilityScore: 25, impactScore: 28 },
  };
  return m[sev];
}

function baseFinding(
  partial: Omit<LayerFinding, "riskScore" | "exploitabilityScore" | "impactScore">,
): LayerFinding {
  return { ...partial, ...scoresFor(partial.severity) };
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/** Docker Hub repository path: library/nginx or bitnami/redis */
export function normalizeDockerHubRepository(imageName: string): string {
  const n = imageName.trim().toLowerCase();
  if (!n) return "library/empty";
  if (!n.includes("/")) return `library/${n}`;
  return n;
}

async function dockerHubToken(repository: string): Promise<string | undefined> {
  const scope = `repository:${repository}:pull`;
  const url = `https://auth.docker.io/token?service=registry.docker.io&scope=${encodeURIComponent(scope)}`;
  const r = await fetchWithTimeout(url, {});
  if (!r.ok) return undefined;
  const j = (await r.json()) as { token?: string; access_token?: string };
  return j.token ?? j.access_token;
}

type ManifestListEntry = {
  digest?: string;
  mediaType?: string;
  platform?: { architecture?: string; os?: string };
};

function pickChildDigest(entries: ManifestListEntry[]): string | undefined {
  const prefers = [
    { os: "linux", arch: "arm64" },
    { os: "linux", arch: "amd64" },
  ];
  for (const { os, arch } of prefers) {
    const hit = entries.find((e) => e.platform?.os === os && e.platform?.architecture === arch && e.digest);
    if (hit?.digest) return hit.digest;
  }
  return entries.find((e) => e.digest)?.digest;
}

async function fetchRegistryManifest(
  registryBase: string,
  repository: string,
  reference: string,
  bearer?: string,
): Promise<{ raw: string; contentType: string } | { error: string }> {
  const url = `${registryBase.replace(/\/$/, "")}/v2/${repository}/manifests/${encodeURIComponent(reference)}`;
  const headers: Record<string, string> = { Accept: ACCEPT_MANIFEST };
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  const r = await fetchWithTimeout(url, { headers });
  const text = await r.text();
  if (!r.ok) {
    return { error: `Registry HTTP ${r.status}: ${text.slice(0, 200)}` };
  }
  const ct = r.headers.get("content-type") ?? "";
  return { raw: text, contentType: ct };
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

type ResolvedLayers = {
  layers: { digest: string; size: number }[];
  configDigest?: string;
};

function layersFromV2Manifest(body: unknown): ResolvedLayers | null {
  if (!body || typeof body !== "object") return null;
  const o = body as { layers?: { digest?: string; size?: number }[]; config?: { digest?: string } };
  if (!Array.isArray(o.layers)) return null;
  const layers = o.layers
    .filter((x) => x && typeof x.digest === "string")
    .map((x) => ({ digest: x.digest as string, size: typeof x.size === "number" ? x.size : 0 }));
  return { layers, configDigest: o.config?.digest };
}

async function resolveImageManifest(
  registryBase: string,
  repository: string,
  tag: string,
  bearer: string | undefined,
): Promise<{ layers: ResolvedLayers; resolvedRef: string } | { error: string }> {
  const first = await fetchRegistryManifest(registryBase, repository, tag, bearer);
  if ("error" in first) return first;

  const body = parseJson(first.raw);
  if (!body || typeof body !== "object") return { error: "Invalid manifest JSON" };

  const mediaType =
    (body as { mediaType?: string }).mediaType ||
    first.contentType.split(";")[0]?.trim() ||
    "";

  const isList =
    mediaType.includes("manifest.list") ||
    mediaType.includes("image.index") ||
    Array.isArray((body as { manifests?: unknown }).manifests);

  if (isList) {
    const manifests = (body as { manifests?: ManifestListEntry[] }).manifests ?? [];
    const digest = pickChildDigest(manifests);
    if (!digest) return { error: "Manifest list contained no resolvable digest" };
    const child = await fetchRegistryManifest(registryBase, repository, digest, bearer);
    if ("error" in child) return child;
    const childBody = parseJson(child.raw);
    const layers = layersFromV2Manifest(childBody);
    if (!layers) return { error: "Child manifest had no layer list" };
    return { layers, resolvedRef: digest };
  }

  const layers = layersFromV2Manifest(body);
  if (!layers) return { error: "Manifest had no layer list (unsupported schema?)" };
  return { layers, resolvedRef: tag };
}

function registryBaseUrl(scan: ContainerScanInput): string | null {
  if (scan.registry === "docker-hub") return "https://registry-1.docker.io";
  if (scan.registry === "custom" && scan.registryUrl?.trim()) {
    return scan.registryUrl.trim().replace(/\/$/, "");
  }
  return null;
}

function unsupportedRegistryFinding(scan: ContainerScanInput): LayerFinding[] {
  return [
    baseFinding({
      title: "Container layers: registry not supported for live manifest pull",
      description: `Registry type "${scan.registry}" is not wired for automated layer manifest inspection in this release. Use **docker-hub** or **custom** with a public OCI/Distribution v2 registry URL, or run a separate image scanner in CI.`,
      severity: "MEDIUM",
      category: "Container Image",
      cwe: "1127",
      location: `registry:${scan.registry}`,
      remediation:
        "For Docker Hub images, set registry to docker-hub. For other public registries exposing /v2/, try custom + registry URL. Private auth is not yet supported here.",
      aiSuggestion:
        "Pin images by digest in Kubernetes/compose and enable registry scanning in your CI (Trivy, Grype) for CVE coverage.",
    }),
  ];
}

/**
 * Build findings from registry manifest metadata (layer count, sizes, tag hygiene).
 */
export async function analyzeContainerScanLayers(scan: ContainerScanInput): Promise<{ findings: LayerFinding[] }> {
  const tag = (scan.imageTag || "latest").trim() || "latest";
  const asset = `${scan.imageName}:${tag}`;

  const base = registryBaseUrl(scan);
  if (!base) {
    return { findings: unsupportedRegistryFinding(scan) };
  }

  const repository =
    scan.registry === "docker-hub"
      ? normalizeDockerHubRepository(scan.imageName)
      : scan.imageName.trim().toLowerCase().replace(/^\/+/, "");

  if (!repository) {
    return {
      findings: [
        baseFinding({
          title: "Container layers: empty image name",
          description: "No repository name was provided for layer inspection.",
          severity: "HIGH",
          category: "Container Image",
          cwe: "1188",
          location: asset,
          remediation: "Provide a valid image repository name (e.g. nginx or bitnami/redis).",
          aiSuggestion: "",
        }),
      ],
    };
  }

  let bearer: string | undefined;
  if (scan.registry === "docker-hub") {
    bearer = await dockerHubToken(repository);
    if (!bearer) {
      return {
        findings: [
          baseFinding({
            title: "Container layers: could not obtain Docker Hub registry token",
            description:
              "The analyzer could not fetch an anonymous pull token from auth.docker.io (network, rate limit, or scope).",
            severity: "HIGH",
            category: "Container Image",
            cwe: "1127",
            location: asset,
            remediation: "Retry later, check network egress, or verify the image name exists on Docker Hub.",
            aiSuggestion: "",
          }),
        ],
      };
    }
  }

  const resolved = await resolveImageManifest(base, repository, tag, bearer);
  if ("error" in resolved) {
    return {
      findings: [
        baseFinding({
          title: "Container layers: manifest fetch failed",
          description: `${resolved.error}\n\nRepository: ${repository}, reference: ${tag}`,
          severity: "HIGH",
          category: "Container Image",
          cwe: "1127",
          location: `${asset} (manifest)`,
          remediation:
            "Confirm the image and tag exist, the registry allows anonymous manifest reads, and the name matches the registry layout (e.g. library/nginx for official images).",
          aiSuggestion: "",
        }),
      ],
    };
  }

  const { layers } = resolved.layers;
  const totalBytes = layers.reduce((s, l) => s + l.size, 0);
  const totalMb = Math.round(totalBytes / (1024 * 1024));
  const n = layers.length;

  const findings: LayerFinding[] = [];

  findings.push(
    baseFinding({
      title: `Container image layer summary (${n} layers)`,
      description: `Resolved manifest reference: \`${resolved.resolvedRef}\`.\n\n- **Layers:** ${n}\n- **Combined layer sizes (manifest metadata):** ~${totalMb} MiB\n\nLayer digests are registry metadata only; this scan does not extract filesystem contents or CVE-match base packages.`,
      severity: "LOW",
      category: "Container Image",
      cwe: "1188",
      location: `manifest:${resolved.resolvedRef.slice(0, 24)}…`,
      remediation:
        "Use this summary with your CI image scanner (Trivy, Grype) and SBOM tools for vulnerability and package detail.",
      aiSuggestion: `Consider pinning this image by digest (sha256:…) in production manifests.`,
    }),
  );

  const tlow = tag.toLowerCase();
  if (tlow === "latest" || tlow === "stable" || tlow === "develop") {
    findings.push(
      baseFinding({
        title: "Container image uses a mutable tag",
        description: `Tag **${tag}** can move to a different image digest over time, breaking reproducibility and surprise-changing dependencies.`,
        severity: "HIGH",
        category: "Container Image",
        cwe: "1188",
        location: `${asset} (tag)`,
        remediation: "Pin to an immutable digest (sha256:…) in Kubernetes, compose, and Terraform, and update deliberately.",
        aiSuggestion: "",
      }),
    );
  }

  if (n >= 36) {
    findings.push(
      baseFinding({
        title: "Container image has a high layer count",
        description: `**${n}** layers increase image size, pull time, and the number of filesystem boundaries to reason about.`,
        severity: "MEDIUM",
        category: "Container Image",
        cwe: "1127",
        location: `${asset} (${n} layers)`,
        remediation: "Combine RUN instructions, use multi-stage builds, and squash where appropriate to reduce layers.",
        aiSuggestion: "",
      }),
    );
  }

  if (totalBytes > 450 * 1024 * 1024) {
    findings.push(
      baseFinding({
        title: "Container image layer metadata indicates a very large image",
        description: `Combined manifest-reported layer sizes ~${totalMb} MiB. Large images slow deploys and widen patching surface.`,
        severity: "MEDIUM",
        category: "Container Image",
        cwe: "1127",
        location: `${asset} (~${totalMb} MiB)`,
        remediation: "Prefer smaller bases (distroless, alpine, wolfi), remove build tools from final stage, and audit installed packages.",
        aiSuggestion: "",
      }),
    );
  }

  return { findings };
}
