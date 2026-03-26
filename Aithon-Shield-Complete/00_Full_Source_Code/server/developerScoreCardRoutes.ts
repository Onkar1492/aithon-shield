import type { Express, RequestHandler } from "express";
import type { IStorage } from "./storage";
import { buildDeveloperScoreCards } from "@shared/developerScoreCards";
import { enrichFindingsList } from "./findingsEnrichment";

export function registerDeveloperScoreCardRoutes(
  app: Express,
  deps: { storage: IStorage; requireAuth: RequestHandler },
): void {
  const { storage, requireAuth } = deps;

  /**
   * Per-project (scan) developer engagement score cards from non-archived findings.
   * Groups by scanType + scanId; uses same visibility as getAllFindings.
   */
  app.get("/api/developer-score-cards", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const raw = await storage.getAllFindings(userId, false);
      const enriched = enrichFindingsList(raw);
      const cards = buildDeveloperScoreCards(enriched);

      res.json({
        generatedAt: new Date().toISOString(),
        cards,
      });
    } catch (e: unknown) {
      console.error("[developer-score-cards GET]", e);
      res.status(500).json({ message: e instanceof Error ? e.message : String(e) });
    }
  });
}
