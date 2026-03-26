/**
 * SBOM generation (CycloneDX 1.5 JSON + SPDX 2.3 JSON) from SCA dependency manifests.
 */
import { randomUUID } from "crypto";
import type { Dependency, DependencyManifest } from "./types";

function purlFor(dep: Dependency): string {
  const ver = dep.version.replace(/\s+/g, "");
  const encName = encodeURIComponent(dep.name).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`);
  switch (dep.type) {
    case "npm":
      return `pkg:npm/${encName}@${encodeURIComponent(ver)}`;
    case "pip":
      return `pkg:pypi/${encodeURIComponent(dep.name.toLowerCase())}@${encodeURIComponent(ver)}`;
    case "maven": {
      const parts = dep.name.split(":");
      if (parts.length >= 2) {
        return `pkg:maven/${parts[0]}/${parts[1]}@${encodeURIComponent(ver)}`;
      }
      return `pkg:maven/${encodeURIComponent(dep.name)}@${encodeURIComponent(ver)}`;
    }
    case "go":
      return `pkg:golang/${encodeURIComponent(dep.name)}@${encodeURIComponent(ver)}`;
    case "gem":
      return `pkg:gem/${encodeURIComponent(dep.name)}@${encodeURIComponent(ver)}`;
    case "composer":
      return `pkg:composer/${encodeURIComponent(dep.name)}@${encodeURIComponent(ver)}`;
    case "cargo":
      return `pkg:cargo/${encodeURIComponent(dep.name)}@${encodeURIComponent(ver)}`;
    default:
      return `pkg:generic/${encodeURIComponent(dep.name)}@${encodeURIComponent(ver)}`;
  }
}

export function buildCycloneDxJson(
  manifest: DependencyManifest,
  meta: { projectName: string; repositoryUrl: string },
): Record<string, unknown> {
  const serial = `urn:uuid:${randomUUID()}`;
  const ts = new Date().toISOString();
  const components = manifest.dependencies.map((d, i) => ({
    type: "library",
    name: d.name,
    version: d.version,
    "bom-ref": `comp-${i}-${d.name.replace(/[^a-zA-Z0-9\-_.]/g, "_")}`,
    purl: purlFor(d),
  }));

  return {
    bomFormat: "CycloneDX",
    specVersion: "1.5",
    serialNumber: serial,
    version: 1,
    metadata: {
      timestamp: ts,
      tools: [
        {
          vendor: "Aithon Shield",
          name: "aithon-sca-sbom",
          version: "1.0.0",
        },
      ],
      component: {
        type: "application",
        name: meta.projectName,
        version: "0.0.0",
        externalReferences: [
          {
            type: "website",
            url: meta.repositoryUrl,
          },
        ],
      },
    },
    components,
  };
}

export function buildSpdxJson(
  manifest: DependencyManifest,
  meta: { projectName: string; repositoryUrl: string },
): Record<string, unknown> {
  const docNs = `https://aithonshield.local/spdx/${randomUUID()}`;
  const ts = new Date().toISOString();
  const rootId = "SPDXRef-RootApp";
  const packages: Record<string, unknown>[] = [
    {
      SPDXID: rootId,
      name: meta.projectName,
      versionInfo: "0.0.0",
      downloadLocation: "NOASSERTION",
      filesAnalyzed: false,
      externalRefs: [
        {
          referenceCategory: "OTHER",
          referenceType: "website",
          referenceLocator: meta.repositoryUrl,
        },
      ],
    },
  ];

  const relationships: { spdxElementId: string; relatedSpdxElement: string; relationshipType: string }[] = [
    {
      spdxElementId: "SPDXRef-DOCUMENT",
      relatedSpdxElement: rootId,
      relationshipType: "DESCRIBES",
    },
  ];

  manifest.dependencies.forEach((d, i) => {
    const pkgId = `SPDXRef-Package-${i}`;
    packages.push({
      SPDXID: pkgId,
      name: d.name,
      versionInfo: d.version,
      downloadLocation: "NOASSERTION",
      filesAnalyzed: false,
      externalRefs: [
        {
          referenceCategory: "PACKAGE-MANAGER",
          referenceType: "purl",
          referenceLocator: purlFor(d),
        },
      ],
    });
    relationships.push({
      spdxElementId: rootId,
      relatedSpdxElement: pkgId,
      relationshipType: "CONTAINS",
    });
  });

  return {
    spdxVersion: "SPDX-2.3",
    dataLicense: "CC0-1.0",
    SPDXID: "SPDXRef-DOCUMENT",
    name: `${meta.projectName} SBOM`,
    documentNamespace: docNs,
    creationInfo: {
      created: ts,
      creators: ["Tool: AithonShield-1.0.0"],
      licenseListVersion: "3.20",
    },
    packages,
    relationships,
  };
}

export function buildSbomFromManifest(
  manifest: DependencyManifest,
  meta: { projectName: string; repositoryUrl: string },
): { cyclonedx: Record<string, unknown>; spdx: Record<string, unknown> } {
  return {
    cyclonedx: buildCycloneDxJson(manifest, meta),
    spdx: buildSpdxJson(manifest, meta),
  };
}
