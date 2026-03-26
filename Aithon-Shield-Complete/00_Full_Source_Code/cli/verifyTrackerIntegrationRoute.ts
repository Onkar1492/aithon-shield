/**
 * Smoke test: GET /api/tracker-connections must be registered (401 without session, not 404).
 * Run from 00_Full_Source_Code: npm run verify:tracker-integration
 */
import express from "express";
import { createServer } from "http";
import type { AddressInfo } from "net";
import { storage } from "../server/storage";
import { buildAuthMiddleware } from "../server/authMiddleware";
import { registerTrackerIntegrationRoutes } from "../server/trackerIntegrationRoutes";

const app = express();
const { requireSessionAuth } = buildAuthMiddleware(storage);
registerTrackerIntegrationRoutes(app, { storage, requireSessionAuth });

const server = createServer(app);

await new Promise<void>((resolve, reject) => {
  server.listen(0, "127.0.0.1", () => resolve());
  server.on("error", reject);
});

try {
  const addr = server.address() as AddressInfo;
  const res = await fetch(`http://127.0.0.1:${addr.port}/api/tracker-connections`);
  const body = await res.text();

  if (res.status === 401) {
    console.log(
      "verify:tracker-integration PASS — GET /api/tracker-connections returns 401 (route registered, session required)",
    );
    process.exit(0);
  }

  console.error("verify:tracker-integration FAIL — expected status 401, got", res.status);
  console.error(body.slice(0, 400));
  process.exit(1);
} catch (e) {
  console.error("verify:tracker-integration FAIL —", e);
  process.exit(1);
} finally {
  server.close();
}
