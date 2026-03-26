/**
 * Smoke test: register webhookRoutes on a minimal Express app and assert
 * GET /api/webhook-endpoints returns 401 (auth enforced, route registered).
 */
import express from "express";
import { registerWebhookRoutes } from "../server/webhookRoutes";
import { DEFAULT_DEV_SERVER_PORT } from "./devServerPort";

const PORT = process.env.PORT ?? DEFAULT_DEV_SERVER_PORT;

async function main() {
  console.log("── verify:webhook-route ──");

  // 1. Isolated Express — route registration only (no DB)
  const app = express();
  app.use(express.json());

  const noopAuth: express.RequestHandler = (_req, res) => res.status(401).json({ message: "Unauthorized" });
  registerWebhookRoutes(app, { storage: {} as any, requireSessionAuth: noopAuth });

  const server = app.listen(0, () => {
    const addr = server.address();
    const p = typeof addr === "object" && addr ? addr.port : 0;
    console.log(`  Temp server on :${p}`);

    fetch(`http://127.0.0.1:${p}/api/webhook-endpoints`)
      .then(async (res) => {
        console.log(`  GET /api/webhook-endpoints → ${res.status}`);
        if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
        console.log("  ✔ Route registered & auth enforced (401)");
      })
      .then(() => {
        // 2. Hit the full dev server if running
        return fetch(`http://127.0.0.1:${PORT}/api/webhook-endpoints`).then(async (res) => {
          console.log(`  Full dev server GET /api/webhook-endpoints → ${res.status}`);
          if (res.status === 401) console.log("  ✔ Dev server route OK (401 — no session)");
          else console.log(`  ⚠ Unexpected status ${res.status} (server may need restart)`);
        }).catch(() => console.log(`  ℹ Dev server on :${PORT} not reachable (skip)`));
      })
      .catch((e) => {
        console.error("  ✘ FAIL:", e);
        process.exitCode = 1;
      })
      .finally(() => server.close());
  });
}

main();
