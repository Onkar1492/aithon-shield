/**
 * Smoke test: GET /api/risk-exceptions must be registered on Express (401 without auth, not 404).
 * Does not start Vite — only the route module + minimal app.
 *
 * Run from 00_Full_Source_Code: npm run verify:risk-exceptions-route
 */
import express from "express";
import { createServer } from "http";
import type { AddressInfo } from "net";
import { storage } from "../server/storage";
import { buildAuthMiddleware } from "../server/authMiddleware";
import { registerRiskExceptionRoutes } from "../server/riskExceptionRoutes";

const app = express();
const { requireAuth } = buildAuthMiddleware(storage);
registerRiskExceptionRoutes(app, { storage, requireAuth });

const server = createServer(app);

await new Promise<void>((resolve, reject) => {
  server.listen(0, "127.0.0.1", () => resolve());
  server.on("error", reject);
});

try {
  const addr = server.address() as AddressInfo;
  const res = await fetch(`http://127.0.0.1:${addr.port}/api/risk-exceptions`);
  const body = await res.text();

  if (res.status === 401) {
    console.log("verify:risk-exceptions-route PASS — GET /api/risk-exceptions returns 401 (route registered, auth required)");
    process.exit(0);
  }

  console.error("verify:risk-exceptions-route FAIL — expected status 401, got", res.status);
  console.error(body.slice(0, 400));
  process.exit(1);
} catch (e) {
  console.error("verify:risk-exceptions-route FAIL —", e);
  process.exit(1);
} finally {
  server.close();
}
