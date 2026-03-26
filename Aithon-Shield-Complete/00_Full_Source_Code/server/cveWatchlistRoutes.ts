import type { Express } from "express";
import { z } from "zod";
import type { IStorage } from "./storage";
import { normalizeCveId } from "@shared/cveWatchlistUtils";
import { logAuditEvent } from "./auditEmitter";
import { rescanAllFindingsForWatchlist } from "./cveWatchlistService";

const createBodySchema = z.object({
  cveId: z.string().min(8).max(32),
  note: z.string().max(2000).optional().nullable(),
});

const patchBodySchema = z.object({
  note: z.string().max(2000).optional().nullable(),
  enabled: z.boolean().optional(),
});

export function registerCveWatchlistRoutes(
  app: Express,
  deps: { storage: IStorage; requireAuth: (req: any, res: any, next: any) => void },
): void {
  const { storage, requireAuth } = deps;

  app.get("/api/cve-watchlist", requireAuth, async (req: any, res) => {
    try {
      const rows = await storage.listCveWatchlistEntries(req.user.id);
      res.json({ entries: rows });
    } catch (e: unknown) {
      console.error("[cve-watchlist GET]", e);
      res.status(500).json({ message: e instanceof Error ? e.message : String(e) });
    }
  });

  app.post("/api/cve-watchlist", requireAuth, async (req: any, res) => {
    try {
      const body = createBodySchema.parse(req.body);
      const cveId = normalizeCveId(body.cveId);
      if (!cveId) {
        return res.status(400).json({ message: "Invalid CVE ID (expected CVE-YYYY-NNNN+)" });
      }
      const row = await storage.createCveWatchlistEntry(req.user.id, {
        cveId,
        note: body.note ?? null,
      });
      void logAuditEvent({
        userId: req.user.id,
        action: "cve_watchlist.create",
        resourceType: "cve_watchlist_entry",
        resourceId: row.id,
        metadata: { cveId },
        req,
      });
      res.status(201).json(row);
    } catch (e: unknown) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request", issues: e.flatten() });
      }
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("unique") || msg.includes("duplicate")) {
        return res.status(409).json({ message: "This CVE is already on your watchlist" });
      }
      console.error("[cve-watchlist POST]", e);
      res.status(500).json({ message: msg });
    }
  });

  app.patch("/api/cve-watchlist/:id", requireAuth, async (req: any, res) => {
    try {
      const body = patchBodySchema.parse(req.body);
      const row = await storage.updateCveWatchlistEntry(req.params.id, req.user.id, body);
      if (!row) {
        return res.status(404).json({ message: "Entry not found" });
      }
      void logAuditEvent({
        userId: req.user.id,
        action: "cve_watchlist.update",
        resourceType: "cve_watchlist_entry",
        resourceId: row.id,
        metadata: { cveId: row.cveId },
        req,
      });
      res.json(row);
    } catch (e: unknown) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request", issues: e.flatten() });
      }
      console.error("[cve-watchlist PATCH]", e);
      res.status(500).json({ message: e instanceof Error ? e.message : String(e) });
    }
  });

  app.delete("/api/cve-watchlist/:id", requireAuth, async (req: any, res) => {
    try {
      const ok = await storage.deleteCveWatchlistEntry(req.params.id, req.user.id);
      if (!ok) {
        return res.status(404).json({ message: "Entry not found" });
      }
      void logAuditEvent({
        userId: req.user.id,
        action: "cve_watchlist.delete",
        resourceType: "cve_watchlist_entry",
        resourceId: req.params.id,
        req,
      });
      res.status(204).send();
    } catch (e: unknown) {
      console.error("[cve-watchlist DELETE]", e);
      res.status(500).json({ message: e instanceof Error ? e.message : String(e) });
    }
  });

  app.post("/api/cve-watchlist/rescan-findings", requireAuth, async (req: any, res) => {
    try {
      const result = await rescanAllFindingsForWatchlist(req.user.id);
      void logAuditEvent({
        userId: req.user.id,
        action: "cve_watchlist.rescan_findings",
        resourceType: "cve_watchlist",
        resourceId: "rescan",
        metadata: result,
        req,
      });
      res.json(result);
    } catch (e: unknown) {
      console.error("[cve-watchlist rescan]", e);
      res.status(500).json({ message: e instanceof Error ? e.message : String(e) });
    }
  });
}
