import type { Finding } from "@shared/schema";
import { extractCveIdsFromText } from "@shared/cveWatchlistUtils";
import { storage } from "./storage";
import { notifyCveWatchlistMatch } from "./pushNotificationService";

/**
 * When a new finding is stored, match CVE mentions against the user's watchlist
 * and create in-app (and optional push) alerts once per (finding, CVE).
 */
export async function processFindingForWatchlist(finding: Finding): Promise<number> {
  if (finding.isArchived) return 0;

  const text = `${finding.title}\n${finding.description ?? ""}`;
  const cvesInFinding = extractCveIdsFromText(text);
  if (cvesInFinding.length === 0) return 0;

  const userId = finding.userId;
  const watchlist = await storage.listCveWatchlistEntries(userId);
  const enabled = new Set(
    watchlist.filter((w) => w.enabled).map((w) => w.cveId.toUpperCase()),
  );

  let newAlerts = 0;
  for (const cveId of cvesInFinding) {
    if (!enabled.has(cveId)) continue;

    const inserted = await storage.tryInsertCveWatchlistNotified(userId, finding.id, cveId);
    if (!inserted) continue;

    newAlerts += 1;

    await storage.createNotification({
      userId,
      type: "cve_watchlist_match",
      title: `Watchlist: ${cveId} detected`,
      message: `A finding references ${cveId}: ${finding.title.slice(0, 140)}${finding.title.length > 140 ? "…" : ""}`,
      scanId: finding.scanId ?? null,
      scanType: finding.scanType ?? null,
      read: false,
      url: `/findings?search=${encodeURIComponent(cveId)}`,
    });

    await notifyCveWatchlistMatch(
      userId,
      cveId,
      finding.title,
      finding.scanId ?? undefined,
      finding.scanType ?? undefined,
    );
  }

  return newAlerts;
}

export async function rescanAllFindingsForWatchlist(userId: string): Promise<{
  processed: number;
  newAlerts: number;
}> {
  const all = await storage.getAllFindings(userId, false);
  let newAlerts = 0;
  let processed = 0;
  for (const f of all) {
    if (f.isArchived) continue;
    processed += 1;
    newAlerts += await processFindingForWatchlist(f);
  }
  return { processed, newAlerts };
}
