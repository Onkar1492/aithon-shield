/**
 * Extracted from server/storage.ts — OpenAPI API security scan CRUD.
 * To restore: add interface methods + implementations back.
 */

// ── Interface (IStorage) ─────────────────────────────────────────────────────

/*
  // API security (OpenAPI) scans — P5-C10
  getAllApiSecurityScans(userId: string): Promise<ApiSecurityScan[]>;
  getApiSecurityScan(id: string, userId: string): Promise<ApiSecurityScan | undefined>;
  createApiSecurityScan(scan: InsertApiSecurityScan): Promise<ApiSecurityScan>;
  updateApiSecurityScan(id: string, userId: string, updates: Partial<ApiSecurityScan>): Promise<ApiSecurityScan | undefined>;
*/

// ── Implementation (DatabaseStorage) ─────────────────────────────────────────

/*
  async getAllApiSecurityScans(userId: string): Promise<ApiSecurityScan[]> {
    return await db.select().from(apiSecurityScans).where(eq(apiSecurityScans.userId, userId));
  }

  async getApiSecurityScan(id: string, userId: string): Promise<ApiSecurityScan | undefined> {
    const result = await db
      .select()
      .from(apiSecurityScans)
      .where(and(eq(apiSecurityScans.id, id), eq(apiSecurityScans.userId, userId)));
    return result[0];
  }

  async createApiSecurityScan(scan: InsertApiSecurityScan): Promise<ApiSecurityScan> {
    const result = await db.insert(apiSecurityScans).values(scan).returning();
    return result[0];
  }

  async updateApiSecurityScan(id: string, userId: string, updates: Partial<ApiSecurityScan>): Promise<ApiSecurityScan | undefined> {
    const result = await db
      .update(apiSecurityScans)
      .set(updates)
      .where(and(eq(apiSecurityScans.id, id), eq(apiSecurityScans.userId, userId)))
      .returning();
    return result[0];
  }
*/

// ── Permission helpers (case "api": branches) ────────────────────────────────

/*
  // In userCanReadScanByType:
  case "api":
    return !!(await this.getApiSecurityScan(scanId, userId));

  // In userCanWriteScanByType:
  case "api":
    return !!(await this.getApiSecurityScan(scanId, userId));

  // In findings scan-name resolution:
  } else if (finding.scanType === "api") {
    const scan = await this.getApiSecurityScan(finding.scanId, userId);
    scanName = scan?.apiName || "API security scan";
    scanCreatedAt = scan?.createdAt || null;
  }
*/
