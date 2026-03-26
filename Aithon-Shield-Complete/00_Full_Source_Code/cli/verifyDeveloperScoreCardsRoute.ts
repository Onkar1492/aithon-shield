/**
 * Smoke test: register developer score card route on minimal Express; assert 401.
 * Optionally hit full dev server on PORT.
 */
import express from "express";
import { registerDeveloperScoreCardRoutes } from "../server/developerScoreCardRoutes";
import { buildDeveloperScoreCards, computeEngagementScore } from "@shared/developerScoreCards";
import { DEFAULT_DEV_SERVER_PORT } from "./devServerPort";

const PORT = process.env.PORT ?? DEFAULT_DEV_SERVER_PORT;

async function main() {
  console.log("── verify:developer-score-cards ──");

  const s = computeEngagementScore({
    total: 10,
    open: 2,
    criticalOpen: 0,
    highOpen: 1,
    mediumOpen: 1,
    lowOpen: 0,
    resolved: 7,
    acceptedRisk: 1,
  });
  if (typeof s !== "number" || s < 0 || s > 100) throw new Error(`computeEngagementScore out of range: ${s}`);
  console.log("  ✔ computeEngagementScore sanity");

  const cards = buildDeveloperScoreCards([
    { scanId: "a", scanType: "mvp", scanName: "Proj", severity: "HIGH", status: "open" },
    { scanId: "a", scanType: "mvp", scanName: "Proj", severity: "LOW", status: "resolved" },
  ]);
  if (cards.length !== 1) throw new Error(`expected 1 card, got ${cards.length}`);
  console.log("  ✔ buildDeveloperScoreCards groups by scan");

  const app = express();
  const noopAuth: express.RequestHandler = (_req, res) => res.status(401).json({ message: "Unauthorized" });
  registerDeveloperScoreCardRoutes(app, { storage: {} as any, requireAuth: noopAuth });

  const server = app.listen(0, () => {
    const addr = server.address();
    const p = typeof addr === "object" && addr ? addr.port : 0;

    fetch(`http://127.0.0.1:${p}/api/developer-score-cards`)
      .then(async (res) => {
        if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
        console.log("  ✔ Route registered & auth enforced (401)");
      })
      .then(() =>
        fetch(`http://127.0.0.1:${PORT}/api/developer-score-cards`).then(async (res) => {
          console.log(`  Full dev server GET → ${res.status}`);
          if (res.status === 401) console.log("  ✔ Dev server route OK (401 — no session)");
          else console.log(`  ⚠ Unexpected ${res.status} (restart dev server if needed)`);
        }).catch(() => console.log(`  ℹ Dev server on :${PORT} not reachable (skip)`)),
      )
      .catch((e) => {
        console.error("  ✘ FAIL:", e);
        process.exitCode = 1;
      })
      .finally(() => server.close());
  });
}

main();
