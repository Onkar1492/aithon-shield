/**
 * Heuristic SCA reachability from static import/require patterns (not a call graph).
 */
import * as fs from "fs/promises";
import * as path from "path";
import type { ScaReachabilityValue } from "@shared/scaReachability";
import type { Dependency, Vulnerability } from "./types";

const MAX_FILE_BYTES = 400_000;
const MAX_FILES = 5000;

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
  "bin",
  "obj",
]);

const SOURCE_EXT = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".vue",
  ".svelte",
  ".py",
  ".pyi",
  ".go",
  ".java",
  ".kt",
  ".kts",
  ".rb",
  ".php",
  ".rs",
]);

interface ImportIndex {
  jsSpecifiers: Set<string>;
  pyRoots: Set<string>;
  goModules: Set<string>;
  javaImports: string[];
  rubyRequires: Set<string>;
  phpUses: string[];
  rustCrates: Set<string>;
}

async function collectFilePaths(root: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string): Promise<void> {
    if (out.length >= MAX_FILES) return;
    let entries: import("fs").Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (out.length >= MAX_FILES) break;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue;
        if (e.name.startsWith(".")) continue;
        await walk(full);
      } else if (e.isFile()) {
        const ext = path.extname(e.name).toLowerCase();
        if (SOURCE_EXT.has(ext)) out.push(full);
      }
    }
  }
  await walk(root);
  return out;
}

async function readFileLimited(abs: string): Promise<string | null> {
  try {
    const st = await fs.stat(abs);
    if (!st.isFile() || st.size > MAX_FILE_BYTES) return null;
    return await fs.readFile(abs, "utf-8");
  } catch {
    return null;
  }
}

function addJsSpecifiers(content: string, target: Set<string>): void {
  const patterns = [
    /\bfrom\s+['"]([^'"]+)['"]/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    const r = new RegExp(re.source, re.flags);
    while ((m = r.exec(content)) !== null) {
      target.add(m[1]);
    }
  }
}

function addPythonRoots(content: string, target: Set<string>): void {
  const fromImport = /^\s*from\s+([a-zA-Z0-9_]+)\s+import\b/gm;
  let m: RegExpExecArray | null;
  while ((m = fromImport.exec(content)) !== null) {
    target.add(m[1].toLowerCase());
  }
  const plainImport = /^\s*import\s+([a-zA-Z0-9_]+(?:\s*,\s*[a-zA-Z0-9_]+)*)\s*(?:#|$)/gm;
  while ((m = plainImport.exec(content)) !== null) {
    for (const part of m[1].split(/\s*,\s*/)) {
      const root = part.trim().toLowerCase();
      if (root) target.add(root);
    }
  }
}

function addGoModules(content: string, target: Set<string>): void {
  let m: RegExpExecArray | null;
  const single = /import\s+"([^"]+)"/g;
  while ((m = single.exec(content)) !== null) {
    target.add(m[1]);
  }
  const multi = /import\s*\(([\s\S]*?)\)/g;
  while ((m = multi.exec(content)) !== null) {
    const inner = m[1];
    let q: RegExpExecArray | null;
    const qr = /"([^"]+)"/g;
    while ((q = qr.exec(inner)) !== null) {
      target.add(q[1]);
    }
  }
}

function addJavaImports(content: string, target: string[]): void {
  const re = /^\s*import\s+([a-zA-Z0-9_.]+)\s*;/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    target.push(m[1].toLowerCase());
  }
}

function addRubyRequires(content: string, target: Set<string>): void {
  const re = /require(?:_relative)?\s*\(?\s*['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    target.add(m[1].toLowerCase());
  }
}

function addPhpUses(content: string, target: string[]): void {
  const re = /^\s*use\s+([^;]+);/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    target.push(m[1].trim().toLowerCase().replace(/\s+/g, ""));
  }
}

function addRustCrates(content: string, target: Set<string>): void {
  const re = /\buse\s+([a-zA-Z0-9_]+)::/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (m[1] !== "crate" && m[1] !== "self" && m[1] !== "super") {
      target.add(m[1].toLowerCase());
    }
  }
}

export async function buildImportIndex(repoPath: string): Promise<ImportIndex> {
  const jsSpecifiers = new Set<string>();
  const pyRoots = new Set<string>();
  const goModules = new Set<string>();
  const javaImports: string[] = [];
  const rubyRequires = new Set<string>();
  const phpUses: string[] = [];
  const rustCrates = new Set<string>();

  const files = await collectFilePaths(repoPath);
  for (const abs of files) {
    const content = await readFileLimited(abs);
    if (!content) continue;
    const ext = path.extname(abs).toLowerCase();
    if ([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".vue", ".svelte"].includes(ext)) {
      addJsSpecifiers(content, jsSpecifiers);
    } else if (ext === ".py" || ext === ".pyi") {
      addPythonRoots(content, pyRoots);
    } else if (ext === ".go") {
      addGoModules(content, goModules);
    } else if (ext === ".java" || ext === ".kt" || ext === ".kts") {
      addJavaImports(content, javaImports);
    } else if (ext === ".rb") {
      addRubyRequires(content, rubyRequires);
    } else if (ext === ".php") {
      addPhpUses(content, phpUses);
    } else if (ext === ".rs") {
      addRustCrates(content, rustCrates);
    }
  }

  return { jsSpecifiers, pyRoots, goModules, javaImports, rubyRequires, phpUses, rustCrates };
}

function npmPackageReferenced(js: Set<string>, pkg: string): boolean {
  for (const spec of js) {
    if (spec === pkg) return true;
    if (spec.startsWith(pkg + "/")) return true;
  }
  return false;
}

function pipPackageReferenced(py: Set<string>, pkg: string): boolean {
  const base = (pkg.split(/[\s\[]/)[0] ?? pkg).trim();
  const candidates = new Set<string>([base.toLowerCase(), base.toLowerCase().replace(/-/g, "_")]);
  for (const c of candidates) {
    if (py.has(c)) return true;
  }
  return false;
}

function goPackageReferenced(go: Set<string>, pkg: string): boolean {
  for (const g of go) {
    if (g === pkg || g.startsWith(pkg + "/")) return true;
  }
  return false;
}

function mavenReferenced(javaImports: string[], pkg: string): boolean {
  const colon = pkg.indexOf(":");
  if (colon === -1) return false;
  const group = pkg.slice(0, colon).toLowerCase();
  const artifact = pkg.slice(colon + 1).toLowerCase().split("@")[0] ?? "";
  const g = group.replace(/\./g, "/");
  return javaImports.some(
    (imp) =>
      imp.includes(group) ||
      imp.includes(g) ||
      (artifact.length >= 3 && imp.includes(artifact)),
  );
}

function gemReferenced(ruby: Set<string>, pkg: string): boolean {
  const n = pkg.toLowerCase();
  if (ruby.has(n)) return true;
  return [...ruby].some((r) => r === n || r.endsWith("/" + n));
}

function composerReferenced(php: string[], pkg: string): boolean {
  const parts = pkg.split("/").filter(Boolean);
  if (parts.length < 2) return false;
  const vendor = parts[0].toLowerCase();
  const seg = parts[1].toLowerCase();
  const compact = seg.replace(/-/g, "");
  return php.some((u) => u.includes(vendor) && (u.includes(seg) || u.includes(compact)));
}

function cargoReferenced(rust: Set<string>, pkg: string): boolean {
  const n = pkg.toLowerCase();
  const under = n.replace(/-/g, "_");
  return rust.has(n) || rust.has(under);
}

function matchIndex(
  index: ImportIndex,
  depName: string,
  ecosystem: Dependency["type"],
): ScaReachabilityValue {
  switch (ecosystem) {
    case "npm":
      return npmPackageReferenced(index.jsSpecifiers, depName) ? "import_referenced" : "no_import_match";
    case "pip":
      return pipPackageReferenced(index.pyRoots, depName) ? "import_referenced" : "no_import_match";
    case "go":
      return goPackageReferenced(index.goModules, depName) ? "import_referenced" : "no_import_match";
    case "maven":
      return mavenReferenced(index.javaImports, depName) ? "import_referenced" : "no_import_match";
    case "gem":
      return gemReferenced(index.rubyRequires, depName) ? "import_referenced" : "no_import_match";
    case "composer":
      return composerReferenced(index.phpUses, depName) ? "import_referenced" : "no_import_match";
    case "cargo":
      return cargoReferenced(index.rustCrates, depName) ? "import_referenced" : "no_import_match";
    case "gradle":
    default:
      return "not_analyzed";
  }
}

export async function annotateScaReachability(
  repoPath: string,
  vulnerabilities: Vulnerability[],
): Promise<void> {
  const needs = vulnerabilities.some(
    (v) => v.category === "Dependency Vulnerability" && v.scaPackage && v.scaEcosystem,
  );
  if (!needs) return;

  const index = await buildImportIndex(repoPath);

  for (const v of vulnerabilities) {
    if (v.category !== "Dependency Vulnerability" || !v.scaPackage || !v.scaEcosystem) continue;
    v.scaReachability = matchIndex(index, v.scaPackage, v.scaEcosystem);
  }
}
