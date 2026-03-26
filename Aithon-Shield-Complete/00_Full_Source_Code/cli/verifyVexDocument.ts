/**
 * Requires a running dev server. Login + GET /api/vex/document; validate CycloneDX VEX shape.
 *
 * Env: PORT (default matches `npm run dev`), AITHON_VERIFY_EMAIL, AITHON_VERIFY_PASSWORD
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
  console.error("verify:vex FAIL — login", loginRes.status, await loginRes.text());
  process.exit(1);
}

const h = loginRes.headers as Headers & { getSetCookie?: () => string[] };
const parts = typeof h.getSetCookie === "function" ? h.getSetCookie() : [];
let cookieHeader = parts.map((c) => c.split(";")[0].trim()).join("; ");
if (!cookieHeader && h.get("set-cookie")) {
  cookieHeader = h.get("set-cookie")!.split(";")[0].trim();
}

if (!cookieHeader.includes("sessionId=")) {
  console.error("verify:vex FAIL — no session cookie");
  process.exit(1);
}

const vexRes = await fetch(`${base}/api/vex/document`, { headers: { Cookie: cookieHeader } });
if (!vexRes.ok) {
  console.error("verify:vex FAIL — /api/vex/document", vexRes.status, await vexRes.text());
  process.exit(1);
}

const ct = vexRes.headers.get("content-type") ?? "";
if (!ct.includes("json")) {
  console.error("verify:vex FAIL — expected JSON content-type, got", ct);
  process.exit(1);
}

const doc = (await vexRes.json()) as Record<string, unknown>;
if (doc.bomFormat !== "CycloneDX" || doc.specVersion !== "1.5") {
  console.error("verify:vex FAIL — not CycloneDX 1.5", doc.bomFormat, doc.specVersion);
  process.exit(1);
}
if (!Array.isArray(doc.vulnerabilities)) {
  console.error("verify:vex FAIL — vulnerabilities must be array");
  process.exit(1);
}

const scansRes = await fetch(`${base}/api/mvp-scans`, { headers: { Cookie: cookieHeader } });
if (scansRes.ok) {
  const scans = (await scansRes.json()) as { id?: string }[];
  const first = Array.isArray(scans) && scans[0]?.id;
  if (first) {
    const scanVex = await fetch(`${base}/api/mvp-scans/${first}/vex`, {
      headers: { Cookie: cookieHeader },
    });
    if (!scanVex.ok) {
      console.error("verify:vex FAIL — mvp-scans vex", scanVex.status, await scanVex.text());
      process.exit(1);
    }
    const sd = (await scanVex.json()) as Record<string, unknown>;
    if (sd.bomFormat !== "CycloneDX" || !Array.isArray(sd.vulnerabilities)) {
      console.error("verify:vex FAIL — scan-scoped document invalid");
      process.exit(1);
    }
    console.log("verify:vex PASS — workspace + mvp scan scoped VEX OK");
    process.exit(0);
  }
}

console.log("verify:vex PASS — workspace VEX OK (no MVP scans to test scope)");
