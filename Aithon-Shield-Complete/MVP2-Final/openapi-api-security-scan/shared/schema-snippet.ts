/**
 * Extracted from shared/schema.ts — apiSecurityScans table + types.
 * To restore: paste back after containerScans block.
 *
 * Also re-add to findings table:
 *   apiSecurityScanId: varchar("api_security_scan_id"),
 * And update scanType comment to include 'api'.
 */

/** P5-C10 — OpenAPI-driven API security posture (static analysis of spec). */
export const apiSecurityScans = pgTable("api_security_scans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  apiName: text("api_name").notNull(),
  specUrl: text("spec_url"),
  specBody: text("spec_body"),
  baseUrlOverride: text("base_url_override"),
  scanStatus: text("scan_status").notNull().default("pending"),
  scanError: text("scan_error"),
  findingsCount: integer("findings_count").notNull().default(0),
  criticalCount: integer("critical_count").notNull().default(0),
  highCount: integer("high_count").notNull().default(0),
  mediumCount: integer("medium_count").notNull().default(0),
  lowCount: integer("low_count").notNull().default(0),
  scannedAt: timestamp("scanned_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

const apiSecurityScanInsertBase = createInsertSchema(apiSecurityScans)
  .omit({ id: true, createdAt: true })
  .extend({ scannedAt: z.coerce.date().optional() });

export const insertApiSecurityScanSchema = apiSecurityScanInsertBase.refine(
  (data) => !!(data.specUrl?.trim() || data.specBody?.trim()),
  { message: "Provide an OpenAPI spec URL or paste JSON/YAML", path: ["specBody"] },
);

export const insertApiSecurityScanBodySchema = apiSecurityScanInsertBase
  .omit({ userId: true })
  .refine(
    (data) => !!(data.specUrl?.trim() || data.specBody?.trim()),
    { message: "Provide an OpenAPI spec URL or paste JSON/YAML", path: ["specBody"] },
  );

export const patchApiSecurityScanSchema = apiSecurityScanInsertBase.partial();

export type InsertApiSecurityScan = z.infer<typeof apiSecurityScanInsertBase>;
export type ApiSecurityScan = typeof apiSecurityScans.$inferSelect;
