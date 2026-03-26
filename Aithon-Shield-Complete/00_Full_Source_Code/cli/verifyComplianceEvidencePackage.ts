/**
 * Requires a running dev server. Login + GET evidence ZIP; assert ZIP magic bytes and expected entries.
 *
 * Env: PORT (default matches `npm run dev`), AITHON_VERIFY_EMAIL, AITHON_VERIFY_PASSWORD (defaults: milan@yahoo.com / 987654321)
 */
import { DEFAULT_DEV_SERVER_PORT } from "./devServerPort";

const port = process.env.PORT ?? DEFAULT_DEV_SERVER_PORT;
const base = `http://127.0.0.1:${port}`;
const email = process.env.AITHON_VERIFY_EMAIL ?? "milan@yahoo.com";
const password = process.env.AITHON_VERIFY_PASSWORD ?? "987654321";

const loginRes = await fetch(`${base}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ emailOrUsername: email, password }),
});

if (!loginRes.ok) {
  console.error("verify:compliance-evidence FAIL — login", loginRes.status, await loginRes.text());
  process.exit(1);
}

const h = loginRes.headers as Headers & { getSetCookie?: () => string[] };
const parts = typeof h.getSetCookie === "function" ? h.getSetCookie() : [];
let cookieHeader = parts.map((c) => c.split(";")[0].trim()).join("; ");
if (!cookieHeader && h.get("set-cookie")) {
  cookieHeader = h.get("set-cookie")!.split(";")[0].trim();
}

if (!cookieHeader.includes("sessionId=")) {
  console.error("verify:compliance-evidence FAIL — no sessionId cookie from login");
  process.exit(1);
}

const zipRes = await fetch(`${base}/api/compliance/evidence-package`, {
  headers: { Cookie: cookieHeader },
});

if (!zipRes.ok) {
  console.error("verify:compliance-evidence FAIL — evidence-package", zipRes.status, await zipRes.text());
  process.exit(1);
}

const ct = zipRes.headers.get("content-type") ?? "";
if (!ct.includes("zip")) {
  console.error("verify:compliance-evidence FAIL — content-type:", ct);
  process.exit(1);
}

const buf = Buffer.from(await zipRes.arrayBuffer());
if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b) {
  console.error("verify:compliance-evidence FAIL — not a ZIP (missing PK header)");
  process.exit(1);
}

const required = [
  "manifest.json",
  "README.txt",
  "findings.json",
  "findings-summary.csv",
  "audit-events.json",
  "sla-summary.json",
  "risk-exceptions.json",
];

const { writeFileSync, unlinkSync } = await import("node:fs");
const { execFileSync } = await import("node:child_process");
const tmp = `compliance-evidence-verify-${Date.now()}.zip`;
writeFileSync(tmp, buf);
try {
  const out = execFileSync(
    "python3",
    [
      "-c",
      "import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); print('\\n'.join(sorted(z.namelist())))",
      tmp,
    ],
    { encoding: "utf-8" },
  );
  const names = out
    .trim()
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const missing = required.filter((n) => !names.includes(n));
  if (missing.length > 0) {
    console.error("verify:compliance-evidence FAIL — missing entries:", missing.join(", "));
    console.error("got:", names.join(", "));
    process.exit(1);
  }
} catch (e) {
  console.error("verify:compliance-evidence FAIL — could not read ZIP (python3 zipfile):", e);
  process.exit(1);
} finally {
  try {
    unlinkSync(tmp);
  } catch {
    /* ignore */
  }
}

console.log("verify:compliance-evidence PASS — ZIP OK, entries:", required.join(", "));
