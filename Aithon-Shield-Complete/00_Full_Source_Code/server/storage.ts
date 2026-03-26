import { type User, type InsertUser, type Session, type InsertSession, type Finding, type InsertFinding, type MobileAppScan, type InsertMobileAppScan, type MvpCodeScan, type InsertMvpCodeScan, type WebAppScan, type InsertWebAppScan, type Report, type InsertReport, type PipelineScan, type InsertPipelineScan, type ContainerScan, type InsertContainerScan, type NetworkScan, type InsertNetworkScan, type LinterScan, type InsertLinterScan, type LinterFixBatch, type InsertLinterFixBatch, type PipelineFixBatch, type InsertPipelineFixBatch, type NetworkFixBatch, type InsertNetworkFixBatch, type ContainerFixBatch, type InsertContainerFixBatch, type ScheduledScan, type InsertScheduledScan, type AlertSettings, type InsertAlertSettings, type SsoProvider, type InsertSsoProvider, type TermsOfServiceAcceptance, type InsertTermsOfServiceAcceptance, type FixValidationSession, type InsertFixValidationSession, type AutomatedFixJob, type InsertAutomatedFixJob, type GlobalFixJob, type InsertGlobalFixJob, type GlobalFixScanTask, type InsertGlobalFixScanTask, type Notification, type InsertNotification, type ApiKey, type AuditEvent, type Organization, type OrganizationMember, type GitConnection, type TrackerConnection, type WebhookEndpoint, type WebhookDelivery, type RemediationJob, type ShieldAdvisorConversation, type CveWatchlistEntry, type RiskException, type SecretsRotationTicket, type LearningProgress } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { users, sessions, apiKeys, findings, mobileAppScans, mvpCodeScans, webAppScans, reports, pipelineScans, containerScans, networkScans, linterScans, linterFixBatches, pipelineFixBatches, networkFixBatches, containerFixBatches, scheduledScans, alertSettings, ssoProviders, termsOfServiceAcceptances, fixValidationSessions, automatedFixJobs, globalFixJobs, globalFixScanTasks, notifications, auditEvents, organizations, organizationMembers, gitConnections, trackerConnections, webhookEndpoints, webhookDeliveries, remediationJobs, shieldAdvisorConversations, cveWatchlistEntries, cveWatchlistNotified, riskExceptions, secretsRotationTickets, learningProgress } from "@shared/schema";
import { eq, and, or, lt, lte, sql, desc, isNull, isNotNull, inArray, type SQL } from "drizzle-orm";
import { organizationRoleCanWriteScans } from "./rbac";
import { encrypt } from "./encryption";
import { calculatePriorityScores } from "./prioritization";
import { computeNextRunAt } from "@shared/scheduledScanUtils";
import { dispatchWebhookEvent } from "./webhookDispatchService";

function statusIsResolved(s: string | null | undefined): boolean {
  if (!s) return false;
  const t = String(s).toLowerCase();
  return t === "resolved" || t === "fixed";
}

function statusIsReopened(s: string | null | undefined): boolean {
  if (!s) return true;
  const t = String(s).toLowerCase();
  return t === "open" || t === "in-progress" || t === "in progress";
}

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByEmailOrUsername(emailOrUsername: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  
  // Session operations
  createSession(session: InsertSession): Promise<Session>;
  getSession(id: string): Promise<Session | undefined>;
  deleteSession(id: string): Promise<void>;
  deleteUserSessions(userId: string): Promise<void>;
  cleanupExpiredSessions(): Promise<void>;

  // API keys (agent / MCP / programmatic access)
  createApiKey(userId: string, name: string, keyPrefix: string, keyHash: string, scopes?: string): Promise<ApiKey>;
  listApiKeys(userId: string): Promise<Pick<ApiKey, "id" | "name" | "keyPrefix" | "scopes" | "createdAt" | "lastUsedAt">[]>;
  deleteApiKey(id: string, userId: string): Promise<boolean>;
  getUserByApiKeyHash(keyHash: string): Promise<User | undefined>;
  getApiKeyRowByHash(keyHash: string): Promise<ApiKey | undefined>;
  touchApiKeyLastUsed(keyHash: string): Promise<void>;

  // Audit log (append-only)
  insertAuditEvent(event: {
    userId: string;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    metadata?: Record<string, unknown> | null;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<AuditEvent>;
  listAuditEvents(userId: string, options?: { limit?: number; offset?: number }): Promise<AuditEvent[]>;

  // Organizations / RBAC
  ensurePersonalOrganization(userId: string, username: string): Promise<void>;
  getOrganizationsForUser(userId: string): Promise<{ organization: Organization; role: string }[]>;
  getOrganizationMemberRole(organizationId: string, userId: string): Promise<string | undefined>;
  canMutateMvpCodeScan(userId: string, scan: MvpCodeScan): Promise<boolean>;
  canMutateMobileAppScan(userId: string, scan: MobileAppScan): Promise<boolean>;
  canMutateWebAppScan(userId: string, scan: WebAppScan): Promise<boolean>;
  /** True if the user may read this scan (org membership / ownership). */
  userCanReadScanByType(userId: string, scanType: string, scanId: string): Promise<boolean>;

  // Git connections (GitHub / GitLab)
  upsertGitConnection(data: {
    userId: string;
    provider: string;
    accessTokenEnc: string;
    refreshTokenEnc?: string | null;
    tokenExpiresAt?: Date | null;
    externalUsername?: string | null;
    externalUserId?: string | null;
    scope?: string | null;
  }): Promise<GitConnection>;
  listGitConnections(userId: string): Promise<GitConnection[]>;
  getGitConnection(userId: string, provider: string): Promise<GitConnection | undefined>;
  deleteGitConnection(id: string, userId: string): Promise<boolean>;

  // Jira / Linear
  upsertTrackerConnection(data: {
    userId: string;
    provider: "jira" | "linear";
    siteBaseUrl?: string | null;
    accountEmail?: string | null;
    accessTokenPlain: string;
    defaultProjectKey?: string | null;
    defaultTeamId?: string | null;
    defaultIssueTypeName?: string | null;
  }): Promise<TrackerConnection>;
  getTrackerConnection(userId: string, provider: "jira" | "linear"): Promise<TrackerConnection | undefined>;
  deleteTrackerConnection(userId: string, provider: "jira" | "linear"): Promise<boolean>;

  // Webhook endpoints
  createWebhookEndpoint(data: { userId: string; name: string; url: string; format: string; secretEnc?: string | null; eventFilter?: string | null; enabled?: boolean }): Promise<WebhookEndpoint>;
  listWebhookEndpoints(userId: string): Promise<WebhookEndpoint[]>;
  getWebhookEndpoint(id: string, userId: string): Promise<WebhookEndpoint | undefined>;
  updateWebhookEndpoint(id: string, userId: string, updates: Partial<{ name: string; url: string; format: string; secretEnc: string | null; eventFilter: string | null; enabled: boolean }>): Promise<WebhookEndpoint | undefined>;
  deleteWebhookEndpoint(id: string, userId: string): Promise<boolean>;
  /** All enabled endpoints for a user that subscribe to the given event type. */
  getWebhookEndpointsForEvent(userId: string, eventType: string): Promise<WebhookEndpoint[]>;
  /** Update delivery status after a dispatch attempt. */
  touchWebhookDelivery(endpointId: string, status: string): Promise<void>;
  /** Insert a delivery log row. */
  insertWebhookDelivery(data: { endpointId: string; eventType: string; httpStatus?: number | null; errorMessage?: string | null; attempt?: number }): Promise<WebhookDelivery>;

  // Remediation jobs
  createRemediationJob(data: {
    userId: string;
    scanType: string;
    scanId: string;
    findingIds?: unknown;
    status?: string;
    provider?: string | null;
    repoFullName?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<RemediationJob>;
  updateRemediationJob(id: string, userId: string, updates: Partial<RemediationJob>): Promise<RemediationJob | undefined>;
  getRemediationJob(id: string, userId: string): Promise<RemediationJob | undefined>;
  listRemediationJobsForScan(userId: string, scanType: string, scanId: string): Promise<RemediationJob[]>;

  // Shield Advisor
  getShieldAdvisorConversation(
    userId: string,
    findingId: string,
    scanType: string,
    scanId: string,
  ): Promise<ShieldAdvisorConversation | undefined>;
  upsertShieldAdvisorConversation(data: {
    userId: string;
    findingId: string;
    scanType: string;
    scanId: string;
    provider: string;
    messages: { role: string; content: string }[];
  }): Promise<ShieldAdvisorConversation>;
  updateUserShieldAdvisorProvider(userId: string, provider: string): Promise<User | undefined>;
  
  // Findings operations
  getAllFindings(userId: string, includeArchived?: boolean): Promise<Finding[]>;
  getFindingsByScan(scanId: string, userId: string, scanType: string): Promise<Finding[]>;
  getFinding(id: string, userId: string): Promise<Finding | undefined>;
  createFinding(finding: InsertFinding): Promise<Finding>;
  updateFinding(id: string, userId: string, updates: Partial<Finding>): Promise<Finding | undefined>;
  updateFindingsByScan(scanId: string, userId: string, updates: Partial<Finding>): Promise<void>;
  markFindingsAsFixed(scanId: string, scanType: string, userId: string): Promise<void>;
  archiveFinding(id: string, userId: string): Promise<Finding | undefined>;
  restoreFinding(id: string, userId: string): Promise<Finding | undefined>;
  getArchivedFindings(userId: string): Promise<Finding[]>;
  cleanupOldArchivedFindings(): Promise<void>;
  recalculatePriorityScores(): Promise<void>;
  getFindingCountsByScan(scanId: string, userId: string, scanType: string): Promise<{
    findingsCount: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
  }>;
  
  // Mobile App Scan operations
  getAllMobileAppScans(userId: string): Promise<MobileAppScan[]>;
  getMobileAppScan(id: string, userId: string): Promise<MobileAppScan | undefined>;
  createMobileAppScan(scan: InsertMobileAppScan & { organizationId?: string | null }): Promise<MobileAppScan>;
  updateMobileAppScan(id: string, userId: string, updates: Partial<MobileAppScan>): Promise<MobileAppScan | undefined>;
  deleteMobileAppScan(id: string, userId: string): Promise<void>;
  
  // MVP Code Scan operations
  getAllMvpCodeScans(userId: string): Promise<MvpCodeScan[]>;
  getMvpCodeScan(id: string, userId: string): Promise<MvpCodeScan | undefined>;
  createMvpCodeScan(scan: InsertMvpCodeScan & { organizationId?: string | null }): Promise<MvpCodeScan>;
  updateMvpCodeScan(id: string, userId: string, updates: Partial<MvpCodeScan>): Promise<MvpCodeScan | undefined>;
  deleteMvpCodeScan(id: string, userId: string): Promise<void>;
  
  // Web App Scan operations
  getAllWebAppScans(userId: string): Promise<WebAppScan[]>;
  getWebAppScan(id: string, userId: string): Promise<WebAppScan | undefined>;
  createWebAppScan(scan: InsertWebAppScan & { organizationId?: string | null }): Promise<WebAppScan>;
  updateWebAppScan(id: string, userId: string, updates: Partial<WebAppScan>): Promise<WebAppScan | undefined>;
  deleteWebAppScan(id: string, userId: string): Promise<void>;
  
  // Report operations
  getAllReports(userId: string): Promise<Report[]>;
  getReport(id: string, userId: string): Promise<Report | undefined>;
  createReport(report: InsertReport): Promise<Report>;
  updateReport(id: string, userId: string, updates: Partial<Report>): Promise<Report | undefined>;
  
  // Pipeline Scan operations
  getAllPipelineScans(userId: string): Promise<PipelineScan[]>;
  getPipelineScan(id: string, userId: string): Promise<PipelineScan | undefined>;
  createPipelineScan(scan: InsertPipelineScan): Promise<PipelineScan>;
  updatePipelineScan(id: string, userId: string, updates: Partial<PipelineScan>): Promise<PipelineScan | undefined>;
  
  // Container Scan operations
  getAllContainerScans(userId: string): Promise<ContainerScan[]>;
  getContainerScan(id: string, userId: string): Promise<ContainerScan | undefined>;
  createContainerScan(scan: InsertContainerScan): Promise<ContainerScan>;
  updateContainerScan(id: string, userId: string, updates: Partial<ContainerScan>): Promise<ContainerScan | undefined>;

  // Network Scan operations
  getAllNetworkScans(userId: string): Promise<NetworkScan[]>;
  getNetworkScan(id: string, userId: string): Promise<NetworkScan | undefined>;
  createNetworkScan(scan: InsertNetworkScan): Promise<NetworkScan>;
  updateNetworkScan(id: string, userId: string, updates: Partial<NetworkScan>): Promise<NetworkScan | undefined>;
  
  // Linter Scan operations
  getAllLinterScans(userId: string): Promise<LinterScan[]>;
  getLinterScan(id: string, userId: string): Promise<LinterScan | undefined>;
  createLinterScan(scan: InsertLinterScan): Promise<LinterScan>;
  updateLinterScan(id: string, userId: string, updates: Partial<LinterScan>): Promise<LinterScan | undefined>;
  
  // Linter Fix Batch operations
  getAllLinterFixBatches(userId: string): Promise<LinterFixBatch[]>;
  getLinterFixBatch(id: string, userId: string): Promise<LinterFixBatch | undefined>;
  getLinterFixBatchByScan(linterScanId: string, userId: string): Promise<LinterFixBatch[]>;
  createLinterFixBatch(batch: InsertLinterFixBatch): Promise<LinterFixBatch>;
  updateLinterFixBatch(id: string, userId: string, updates: Partial<LinterFixBatch>): Promise<LinterFixBatch | undefined>;
  
  // Pipeline fix batches
  getAllPipelineFixBatches(userId: string): Promise<PipelineFixBatch[]>;
  getPipelineFixBatch(id: string, userId: string): Promise<PipelineFixBatch | undefined>;
  getPipelineFixBatchByScan(pipelineScanId: string, userId: string): Promise<PipelineFixBatch[]>;
  createPipelineFixBatch(batch: InsertPipelineFixBatch): Promise<PipelineFixBatch>;
  updatePipelineFixBatch(id: string, userId: string, updates: Partial<PipelineFixBatch>): Promise<PipelineFixBatch | undefined>;
  
  // Network fix batches
  getAllNetworkFixBatches(userId: string): Promise<NetworkFixBatch[]>;
  getNetworkFixBatch(id: string, userId: string): Promise<NetworkFixBatch | undefined>;
  getNetworkFixBatchByScan(networkScanId: string, userId: string): Promise<NetworkFixBatch[]>;
  createNetworkFixBatch(batch: InsertNetworkFixBatch): Promise<NetworkFixBatch>;
  updateNetworkFixBatch(id: string, userId: string, updates: Partial<NetworkFixBatch>): Promise<NetworkFixBatch | undefined>;
  
  // Container fix batches
  getAllContainerFixBatches(userId: string): Promise<ContainerFixBatch[]>;
  getContainerFixBatch(id: string, userId: string): Promise<ContainerFixBatch | undefined>;
  getContainerFixBatchByScan(containerScanId: string, userId: string): Promise<ContainerFixBatch[]>;
  createContainerFixBatch(batch: InsertContainerFixBatch): Promise<ContainerFixBatch>;
  updateContainerFixBatch(id: string, userId: string, updates: Partial<ContainerFixBatch>): Promise<ContainerFixBatch | undefined>;
  
  // Scheduled Scan operations
  getAllScheduledScans(userId: string): Promise<ScheduledScan[]>;
  getScheduledScan(id: string, userId: string): Promise<ScheduledScan | undefined>;
  /** Due jobs: active and `next_run_at` null or ≤ `asOf`. */
  getDueScheduledScans(asOf: Date): Promise<ScheduledScan[]>;
  /**
   * Advances `last_run_at` / `next_run_at` only if still due (optimistic lock on `next_run_at`).
   * Returns the updated row, or undefined if another worker claimed or schedule changed.
   */
  claimScheduledScanRun(row: ScheduledScan, asOf: Date): Promise<ScheduledScan | undefined>;
  createScheduledScan(scan: InsertScheduledScan): Promise<ScheduledScan>;
  updateScheduledScan(id: string, userId: string, updates: Partial<ScheduledScan>): Promise<ScheduledScan | undefined>;
  deleteScheduledScan(id: string, userId: string): Promise<void>;
  
  // Alert Settings operations
  getAlertSettings(userId: string): Promise<AlertSettings | undefined>;
  updateAlertSettings(userId: string, settings: Partial<AlertSettings>): Promise<AlertSettings>;
  
  // SSO Provider operations
  getAllSsoProviders(): Promise<SsoProvider[]>;
  getEnabledSsoProviders(): Promise<SsoProvider[]>;
  getSsoProvider(id: string): Promise<SsoProvider | undefined>;
  createSsoProvider(provider: InsertSsoProvider): Promise<SsoProvider>;
  updateSsoProvider(id: string, updates: Partial<SsoProvider>): Promise<SsoProvider | undefined>;
  deleteSsoProvider(id: string): Promise<void>;
  
  // Terms of Service Acceptance operations
  getToSAcceptance(userId: string): Promise<TermsOfServiceAcceptance | undefined>;
  createToSAcceptance(acceptance: InsertTermsOfServiceAcceptance): Promise<TermsOfServiceAcceptance>;
  updateToSAcceptance(userId: string, updates: Partial<TermsOfServiceAcceptance>): Promise<TermsOfServiceAcceptance | undefined>;
  
  // Fix Validation Session operations
  getFixValidationSession(id: string, userId: string): Promise<FixValidationSession | undefined>;
  getFixValidationSessionByScan(scanId: string, userId: string): Promise<FixValidationSession | undefined>;
  createFixValidationSession(session: InsertFixValidationSession): Promise<FixValidationSession>;
  updateFixValidationSession(id: string, userId: string, updates: Partial<FixValidationSession>): Promise<FixValidationSession | undefined>;
  
  // Automated Fix Job operations
  getAutomatedFixJob(id: string, userId: string): Promise<AutomatedFixJob | undefined>;
  getAutomatedFixJobBySession(sessionId: string, userId: string): Promise<AutomatedFixJob | undefined>;
  createAutomatedFixJob(job: InsertAutomatedFixJob): Promise<AutomatedFixJob>;
  updateAutomatedFixJob(id: string, userId: string, updates: Partial<AutomatedFixJob>): Promise<AutomatedFixJob | undefined>;
  
  // Global Fix Job operations
  getGlobalFixJob(id: string, userId: string): Promise<GlobalFixJob | undefined>;
  getAllGlobalFixJobs(userId: string): Promise<GlobalFixJob[]>;
  createGlobalFixJob(job: InsertGlobalFixJob): Promise<GlobalFixJob>;
  updateGlobalFixJob(id: string, userId: string, updates: Partial<GlobalFixJob>): Promise<GlobalFixJob | undefined>;
  
  // Global Fix Scan Task operations
  getGlobalFixScanTask(id: string, userId: string): Promise<GlobalFixScanTask | undefined>;
  getGlobalFixScanTasks(jobId: string, userId: string): Promise<GlobalFixScanTask[]>;
  createGlobalFixScanTask(task: InsertGlobalFixScanTask): Promise<GlobalFixScanTask>;
  updateGlobalFixScanTask(id: string, userId: string, updates: Partial<GlobalFixScanTask>): Promise<GlobalFixScanTask | undefined>;
  
  // Notification operations
  getNotifications(userId: string, limit?: number): Promise<Notification[]>;
  getUnreadNotifications(userId: string): Promise<Notification[]>;
  getNotification(id: string, userId: string): Promise<Notification | undefined>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: string, userId: string): Promise<Notification | undefined>;
  markAllNotificationsAsRead(userId: string): Promise<void>;
  getUnreadNotificationCount(userId: string): Promise<number>;

  // CVE watchlist
  listCveWatchlistEntries(userId: string): Promise<CveWatchlistEntry[]>;
  createCveWatchlistEntry(userId: string, data: { cveId: string; note?: string | null }): Promise<CveWatchlistEntry>;
  updateCveWatchlistEntry(
    id: string,
    userId: string,
    updates: Partial<{ note: string | null; enabled: boolean }>,
  ): Promise<CveWatchlistEntry | undefined>;
  deleteCveWatchlistEntry(id: string, userId: string): Promise<boolean>;
  tryInsertCveWatchlistNotified(userId: string, findingId: string, cveId: string): Promise<boolean>;

  // Risk exceptions / accepted risk
  listRiskExceptionsForUser(userId: string): Promise<
    (RiskException & { findingTitle: string; findingSeverity: string })[]
  >;
  createRiskException(
    userId: string,
    data: { findingId: string; justification: string; expiresAt?: Date | null },
  ): Promise<RiskException>;
  revokeRiskException(id: string, userId: string): Promise<RiskException | undefined>;
  /** Revokes the active exception for a finding (e.g. from Findings row without exception id). */
  revokeActiveRiskExceptionForFinding(userId: string, findingId: string): Promise<RiskException | undefined>;

  // Secrets rotation workflow (P5-H3)
  listSecretsRotationTickets(userId: string): Promise<SecretsRotationTicket[]>;
  getSecretsRotationTicket(id: string, userId: string): Promise<SecretsRotationTicket | undefined>;
  createSecretsRotationTicket(userId: string, data: {
    secretName: string;
    secretType: string;
    location?: string | null;
    severity?: string;
    findingId?: string | null;
    notes?: string | null;
    secretsManager?: string | null;
  }): Promise<SecretsRotationTicket>;
  updateSecretsRotationTicket(id: string, userId: string, data: Partial<{
    status: string;
    stepRemovedFromCode: boolean;
    stepNewSecretGenerated: boolean;
    stepStoredInManager: boolean;
    stepAppConfigUpdated: boolean;
    stepOldSecretRevoked: boolean;
    stepVerified: boolean;
    notes: string | null;
    secretsManager: string | null;
  }>): Promise<SecretsRotationTicket | undefined>;
  deleteSecretsRotationTicket(id: string, userId: string): Promise<boolean>;
  autoCreateSecretsRotationTickets(userId: string): Promise<{ created: number; skipped: number }>;

  // Learning progress operations
  getLearningProgress(userId: string): Promise<LearningProgress[]>;
  upsertLearningProgress(userId: string, contentId: string, contentType: string, updates: { completed?: boolean; lastSectionIndex?: number }): Promise<LearningProgress>;
}

export class DbStorage implements IStorage {
  constructor() {}

  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const normalized = username.trim().toLowerCase();
    if (!normalized) return undefined;
    const result = await db.select().from(users).where(
      sql`LOWER(${users.username}) = ${normalized}`
    );
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return undefined;
    const result = await db.select().from(users).where(
      sql`LOWER(${users.email}) = ${normalized}`
    );
    return result[0];
  }

  async getUserByEmailOrUsername(emailOrUsername: string): Promise<User | undefined> {
    // Trim so pasted emails/usernames match; case-insensitive for both email and username
    const normalized = emailOrUsername.trim().toLowerCase();
    if (!normalized) return undefined;
    const result = await db.select().from(users).where(
      sql`LOWER(${users.email}) = ${normalized} OR LOWER(${users.username}) = ${normalized}`
    );
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const result = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  // Session operations
  async createSession(session: InsertSession): Promise<Session> {
    const result = await db.insert(sessions).values(session).returning();
    return result[0];
  }

  async getSession(id: string): Promise<Session | undefined> {
    const result = await db.select().from(sessions).where(eq(sessions.id, id));
    return result[0];
  }

  async deleteSession(id: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.id, id));
  }

  async deleteUserSessions(userId: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.userId, userId));
  }

  async cleanupExpiredSessions(): Promise<void> {
    await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  }

  async createApiKey(
    userId: string,
    name: string,
    keyPrefix: string,
    keyHash: string,
    scopes = "read,write",
  ): Promise<ApiKey> {
    const result = await db
      .insert(apiKeys)
      .values({ userId, name, keyPrefix, keyHash, scopes })
      .returning();
    return result[0];
  }

  async listApiKeys(
    userId: string,
  ): Promise<Pick<ApiKey, "id" | "name" | "keyPrefix" | "scopes" | "createdAt" | "lastUsedAt">[]> {
    return db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        scopes: apiKeys.scopes,
        createdAt: apiKeys.createdAt,
        lastUsedAt: apiKeys.lastUsedAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.userId, userId))
      .orderBy(desc(apiKeys.createdAt));
  }

  async deleteApiKey(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(apiKeys)
      .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)))
      .returning({ id: apiKeys.id });
    return result.length > 0;
  }

  async getUserByApiKeyHash(keyHash: string): Promise<User | undefined> {
    const row = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash)).limit(1);
    if (!row[0]) return undefined;
    return this.getUser(row[0].userId);
  }

  async touchApiKeyLastUsed(keyHash: string): Promise<void> {
    await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.keyHash, keyHash));
  }

  async getApiKeyRowByHash(keyHash: string): Promise<ApiKey | undefined> {
    const row = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash)).limit(1);
    return row[0];
  }

  async insertAuditEvent(event: {
    userId: string;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    metadata?: Record<string, unknown> | null;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<AuditEvent> {
    const [row] = await db
      .insert(auditEvents)
      .values({
        userId: event.userId,
        action: event.action,
        resourceType: event.resourceType,
        resourceId: event.resourceId ?? null,
        metadata: event.metadata ?? null,
        ipAddress: event.ipAddress ?? null,
        userAgent: event.userAgent ?? null,
      })
      .returning();
    return row;
  }

  async listAuditEvents(userId: string, options?: { limit?: number; offset?: number }): Promise<AuditEvent[]> {
    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;
    return db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.userId, userId))
      .orderBy(desc(auditEvents.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async ensurePersonalOrganization(userId: string, username: string): Promise<void> {
    const user = await this.getUser(userId);
    if (!user || user.defaultOrganizationId) return;
    const slug = `u${userId.replace(/-/g, "")}`;
    const existing = await db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
    let orgId: string;
    if (existing[0]) {
      orgId = existing[0].id;
      const alreadyMember = await db
        .select({ id: organizationMembers.id })
        .from(organizationMembers)
        .where(and(eq(organizationMembers.organizationId, orgId), eq(organizationMembers.userId, userId)))
        .limit(1);
      if (!alreadyMember[0]) {
        await db.insert(organizationMembers).values({
          organizationId: orgId,
          userId,
          role: "owner",
        });
      }
    } else {
      const [org] = await db
        .insert(organizations)
        .values({ name: `${username}'s workspace`, slug })
        .returning();
      orgId = org.id;
      await db.insert(organizationMembers).values({
        organizationId: orgId,
        userId,
        role: "owner",
      });
    }
    await db.update(users).set({ defaultOrganizationId: orgId }).where(eq(users.id, userId));
  }

  async getOrganizationsForUser(userId: string): Promise<{ organization: Organization; role: string }[]> {
    const rows = await db
      .select({
        organization: organizations,
        role: organizationMembers.role,
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
      .where(eq(organizationMembers.userId, userId));
    return rows;
  }

  async getOrganizationMemberRole(organizationId: string, userId: string): Promise<string | undefined> {
    const row = await db
      .select({ role: organizationMembers.role })
      .from(organizationMembers)
      .where(
        and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.userId, userId)),
      )
      .limit(1);
    return row[0]?.role;
  }

  async canMutateMvpCodeScan(userId: string, scan: MvpCodeScan): Promise<boolean> {
    return this.userCanWriteMvpScan(userId, scan);
  }

  async canMutateMobileAppScan(userId: string, scan: MobileAppScan): Promise<boolean> {
    return this.userCanWriteMobileScan(userId, scan);
  }

  async canMutateWebAppScan(userId: string, scan: WebAppScan): Promise<boolean> {
    return this.userCanWriteWebScan(userId, scan);
  }

  private async getOrganizationIdsForUser(userId: string): Promise<string[]> {
    const rows = await db
      .select({ organizationId: organizationMembers.organizationId })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, userId));
    return rows.map((r) => r.organizationId);
  }

  private mvpScanAccessWhere(userId: string, orgIds: string[]): SQL {
    const legacyPersonal = and(eq(mvpCodeScans.userId, userId), isNull(mvpCodeScans.organizationId));
    if (orgIds.length === 0) {
      return legacyPersonal!;
    }
    return or(legacyPersonal, inArray(mvpCodeScans.organizationId, orgIds))!;
  }

  private mobileScanAccessWhere(userId: string, orgIds: string[]): SQL {
    const legacyPersonal = and(eq(mobileAppScans.userId, userId), isNull(mobileAppScans.organizationId));
    if (orgIds.length === 0) {
      return legacyPersonal!;
    }
    return or(legacyPersonal, inArray(mobileAppScans.organizationId, orgIds))!;
  }

  private webScanAccessWhere(userId: string, orgIds: string[]): SQL {
    const legacyPersonal = and(eq(webAppScans.userId, userId), isNull(webAppScans.organizationId));
    if (orgIds.length === 0) {
      return legacyPersonal!;
    }
    return or(legacyPersonal, inArray(webAppScans.organizationId, orgIds))!;
  }

  private async userCanReadMvpScan(userId: string, scan: MvpCodeScan): Promise<boolean> {
    if (!scan.organizationId) {
      return scan.userId === userId;
    }
    const orgIds = await this.getOrganizationIdsForUser(userId);
    return orgIds.includes(scan.organizationId);
  }

  private async userCanWriteMvpScan(userId: string, scan: MvpCodeScan): Promise<boolean> {
    if (!scan.organizationId) {
      return scan.userId === userId;
    }
    const role = await this.getOrganizationMemberRole(scan.organizationId, userId);
    return organizationRoleCanWriteScans(role);
  }

  private async userCanReadMobileScan(userId: string, scan: MobileAppScan): Promise<boolean> {
    if (!scan.organizationId) {
      return scan.userId === userId;
    }
    const orgIds = await this.getOrganizationIdsForUser(userId);
    return orgIds.includes(scan.organizationId);
  }

  private async userCanWriteMobileScan(userId: string, scan: MobileAppScan): Promise<boolean> {
    if (!scan.organizationId) {
      return scan.userId === userId;
    }
    const role = await this.getOrganizationMemberRole(scan.organizationId, userId);
    return organizationRoleCanWriteScans(role);
  }

  private async userCanReadWebScan(userId: string, scan: WebAppScan): Promise<boolean> {
    if (!scan.organizationId) {
      return scan.userId === userId;
    }
    const orgIds = await this.getOrganizationIdsForUser(userId);
    return orgIds.includes(scan.organizationId);
  }

  private async userCanWriteWebScan(userId: string, scan: WebAppScan): Promise<boolean> {
    if (!scan.organizationId) {
      return scan.userId === userId;
    }
    const role = await this.getOrganizationMemberRole(scan.organizationId, userId);
    return organizationRoleCanWriteScans(role);
  }

  async userCanReadScanByType(userId: string, scanType: string, scanId: string): Promise<boolean> {
    switch (scanType) {
      case "mvp": {
        const row = await db.select().from(mvpCodeScans).where(eq(mvpCodeScans.id, scanId)).limit(1);
        const scan = row[0];
        return scan ? this.userCanReadMvpScan(userId, scan) : false;
      }
      case "mobile": {
        const row = await db.select().from(mobileAppScans).where(eq(mobileAppScans.id, scanId)).limit(1);
        const scan = row[0];
        return scan ? this.userCanReadMobileScan(userId, scan) : false;
      }
      case "web": {
        const row = await db.select().from(webAppScans).where(eq(webAppScans.id, scanId)).limit(1);
        const scan = row[0];
        return scan ? this.userCanReadWebScan(userId, scan) : false;
      }
      case "pipeline":
        return !!(await this.getPipelineScan(scanId, userId));
      case "container":
        return !!(await this.getContainerScan(scanId, userId));
      case "network":
        return !!(await this.getNetworkScan(scanId, userId));
      case "linter":
        return !!(await this.getLinterScan(scanId, userId));
      default:
        return false;
    }
  }

  private async userCanWriteScanByType(userId: string, scanType: string, scanId: string): Promise<boolean> {
    switch (scanType) {
      case "mvp": {
        const row = await db.select().from(mvpCodeScans).where(eq(mvpCodeScans.id, scanId)).limit(1);
        const scan = row[0];
        return scan ? this.userCanWriteMvpScan(userId, scan) : false;
      }
      case "mobile": {
        const row = await db.select().from(mobileAppScans).where(eq(mobileAppScans.id, scanId)).limit(1);
        const scan = row[0];
        return scan ? this.userCanWriteMobileScan(userId, scan) : false;
      }
      case "web": {
        const row = await db.select().from(webAppScans).where(eq(webAppScans.id, scanId)).limit(1);
        const scan = row[0];
        return scan ? this.userCanWriteWebScan(userId, scan) : false;
      }
      case "pipeline":
        return !!(await this.getPipelineScan(scanId, userId));
      case "container":
        return !!(await this.getContainerScan(scanId, userId));
      case "network":
        return !!(await this.getNetworkScan(scanId, userId));
      case "linter":
        return !!(await this.getLinterScan(scanId, userId));
      default:
        return false;
    }
  }

  private async userCanReadFindingRow(userId: string, f: Finding): Promise<boolean> {
    if (!f.scanId || !f.scanType) {
      return f.userId === userId;
    }
    return this.userCanReadScanByType(userId, f.scanType, f.scanId);
  }

  private async userCanWriteFindingRow(userId: string, f: Finding): Promise<boolean> {
    if (!f.scanId || !f.scanType) {
      return f.userId === userId;
    }
    return this.userCanWriteScanByType(userId, f.scanType, f.scanId);
  }

  private async getAccessibleMvpScanIds(userId: string): Promise<string[]> {
    const orgIds = await this.getOrganizationIdsForUser(userId);
    const rows = await db
      .select({ id: mvpCodeScans.id })
      .from(mvpCodeScans)
      .where(this.mvpScanAccessWhere(userId, orgIds));
    return rows.map((r) => r.id);
  }

  private async getAccessibleMobileScanIds(userId: string): Promise<string[]> {
    const orgIds = await this.getOrganizationIdsForUser(userId);
    const rows = await db
      .select({ id: mobileAppScans.id })
      .from(mobileAppScans)
      .where(this.mobileScanAccessWhere(userId, orgIds));
    return rows.map((r) => r.id);
  }

  private async getAccessibleWebScanIds(userId: string): Promise<string[]> {
    const orgIds = await this.getOrganizationIdsForUser(userId);
    const rows = await db
      .select({ id: webAppScans.id })
      .from(webAppScans)
      .where(this.webScanAccessWhere(userId, orgIds));
    return rows.map((r) => r.id);
  }

  async upsertGitConnection(data: {
    userId: string;
    provider: string;
    accessTokenEnc: string;
    refreshTokenEnc?: string | null;
    tokenExpiresAt?: Date | null;
    externalUsername?: string | null;
    externalUserId?: string | null;
    scope?: string | null;
  }): Promise<GitConnection> {
    const existing = await db
      .select()
      .from(gitConnections)
      .where(and(eq(gitConnections.userId, data.userId), eq(gitConnections.provider, data.provider)))
      .limit(1);
    if (existing[0]) {
      const [row] = await db
        .update(gitConnections)
        .set({
          accessTokenEnc: data.accessTokenEnc,
          refreshTokenEnc: data.refreshTokenEnc ?? null,
          tokenExpiresAt: data.tokenExpiresAt ?? null,
          externalUsername: data.externalUsername ?? null,
          externalUserId: data.externalUserId ?? null,
          scope: data.scope ?? null,
          updatedAt: new Date(),
        })
        .where(eq(gitConnections.id, existing[0].id))
        .returning();
      return row;
    }
    const [row] = await db
      .insert(gitConnections)
      .values({
        userId: data.userId,
        provider: data.provider,
        accessTokenEnc: data.accessTokenEnc,
        refreshTokenEnc: data.refreshTokenEnc ?? null,
        tokenExpiresAt: data.tokenExpiresAt ?? null,
        externalUsername: data.externalUsername ?? null,
        externalUserId: data.externalUserId ?? null,
        scope: data.scope ?? null,
      })
      .returning();
    return row;
  }

  async listGitConnections(userId: string): Promise<GitConnection[]> {
    return db.select().from(gitConnections).where(eq(gitConnections.userId, userId));
  }

  async getGitConnection(userId: string, provider: string): Promise<GitConnection | undefined> {
    const row = await db
      .select()
      .from(gitConnections)
      .where(and(eq(gitConnections.userId, userId), eq(gitConnections.provider, provider)))
      .limit(1);
    return row[0];
  }

  async deleteGitConnection(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(gitConnections)
      .where(and(eq(gitConnections.id, id), eq(gitConnections.userId, userId)))
      .returning({ id: gitConnections.id });
    return result.length > 0;
  }

  async upsertTrackerConnection(data: {
    userId: string;
    provider: "jira" | "linear";
    siteBaseUrl?: string | null;
    accountEmail?: string | null;
    accessTokenPlain: string;
    defaultProjectKey?: string | null;
    defaultTeamId?: string | null;
    defaultIssueTypeName?: string | null;
  }): Promise<TrackerConnection> {
    const enc = encrypt(data.accessTokenPlain);
    if (!enc) throw new Error("Failed to encrypt tracker credential");

    const existing = await db
      .select()
      .from(trackerConnections)
      .where(and(eq(trackerConnections.userId, data.userId), eq(trackerConnections.provider, data.provider)))
      .limit(1);

    const now = new Date();
    if (existing[0]) {
      const [row] = await db
        .update(trackerConnections)
        .set({
          siteBaseUrl: data.siteBaseUrl ?? null,
          accountEmail: data.accountEmail ?? null,
          accessTokenEnc: enc,
          defaultProjectKey: data.defaultProjectKey ?? null,
          defaultTeamId: data.defaultTeamId ?? null,
          defaultIssueTypeName: data.defaultIssueTypeName ?? existing[0].defaultIssueTypeName ?? "Task",
          updatedAt: now,
        })
        .where(eq(trackerConnections.id, existing[0].id))
        .returning();
      return row;
    }

    const [row] = await db
      .insert(trackerConnections)
      .values({
        userId: data.userId,
        provider: data.provider,
        siteBaseUrl: data.siteBaseUrl ?? null,
        accountEmail: data.accountEmail ?? null,
        accessTokenEnc: enc,
        defaultProjectKey: data.defaultProjectKey ?? null,
        defaultTeamId: data.defaultTeamId ?? null,
        defaultIssueTypeName: data.defaultIssueTypeName ?? "Task",
        updatedAt: now,
      })
      .returning();
    return row;
  }

  async getTrackerConnection(userId: string, provider: "jira" | "linear"): Promise<TrackerConnection | undefined> {
    const row = await db
      .select()
      .from(trackerConnections)
      .where(and(eq(trackerConnections.userId, userId), eq(trackerConnections.provider, provider)))
      .limit(1);
    return row[0];
  }

  async deleteTrackerConnection(userId: string, provider: "jira" | "linear"): Promise<boolean> {
    const result = await db
      .delete(trackerConnections)
      .where(and(eq(trackerConnections.userId, userId), eq(trackerConnections.provider, provider)))
      .returning({ id: trackerConnections.id });
    return result.length > 0;
  }

  // ── Webhook endpoints ──────────────────────────────────────

  async createWebhookEndpoint(data: { userId: string; name: string; url: string; format: string; secretEnc?: string | null; eventFilter?: string | null; enabled?: boolean }): Promise<WebhookEndpoint> {
    const [row] = await db.insert(webhookEndpoints).values({
      userId: data.userId,
      name: data.name,
      url: data.url,
      format: data.format,
      secretEnc: data.secretEnc ?? null,
      eventFilter: data.eventFilter ?? null,
      enabled: data.enabled ?? true,
    }).returning();
    return row;
  }

  async listWebhookEndpoints(userId: string): Promise<WebhookEndpoint[]> {
    return db.select().from(webhookEndpoints).where(eq(webhookEndpoints.userId, userId)).orderBy(desc(webhookEndpoints.createdAt));
  }

  async getWebhookEndpoint(id: string, userId: string): Promise<WebhookEndpoint | undefined> {
    const rows = await db.select().from(webhookEndpoints).where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.userId, userId))).limit(1);
    return rows[0];
  }

  async updateWebhookEndpoint(id: string, userId: string, updates: Partial<{ name: string; url: string; format: string; secretEnc: string | null; eventFilter: string | null; enabled: boolean }>): Promise<WebhookEndpoint | undefined> {
    const rows = await db.update(webhookEndpoints).set({ ...updates, updatedAt: new Date() }).where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.userId, userId))).returning();
    return rows[0];
  }

  async deleteWebhookEndpoint(id: string, userId: string): Promise<boolean> {
    const rows = await db.delete(webhookEndpoints).where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.userId, userId))).returning({ id: webhookEndpoints.id });
    return rows.length > 0;
  }

  async getWebhookEndpointsForEvent(userId: string, eventType: string): Promise<WebhookEndpoint[]> {
    const all = await db.select().from(webhookEndpoints).where(and(eq(webhookEndpoints.userId, userId), eq(webhookEndpoints.enabled, true)));
    return all.filter((ep) => {
      if (!ep.eventFilter) return true;
      const types = ep.eventFilter.split(",").map((s) => s.trim().toLowerCase());
      return types.includes(eventType.toLowerCase()) || types.includes("*");
    });
  }

  async touchWebhookDelivery(endpointId: string, status: string): Promise<void> {
    await db.update(webhookEndpoints).set({ lastDeliveredAt: new Date(), lastDeliveryStatus: status, updatedAt: new Date() }).where(eq(webhookEndpoints.id, endpointId));
  }

  async insertWebhookDelivery(data: { endpointId: string; eventType: string; httpStatus?: number | null; errorMessage?: string | null; attempt?: number }): Promise<WebhookDelivery> {
    const [row] = await db.insert(webhookDeliveries).values({
      endpointId: data.endpointId,
      eventType: data.eventType,
      httpStatus: data.httpStatus ?? null,
      errorMessage: data.errorMessage ?? null,
      attempt: data.attempt ?? 0,
    }).returning();
    return row;
  }

  async createRemediationJob(data: {
    userId: string;
    scanType: string;
    scanId: string;
    findingIds?: unknown;
    status?: string;
    provider?: string | null;
    repoFullName?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<RemediationJob> {
    const [row] = await db
      .insert(remediationJobs)
      .values({
        userId: data.userId,
        scanType: data.scanType,
        scanId: data.scanId,
        findingIds: data.findingIds as any,
        status: data.status ?? "pending",
        provider: data.provider ?? null,
        repoFullName: data.repoFullName ?? null,
        metadata: data.metadata ?? null,
      })
      .returning();
    return row;
  }

  async updateRemediationJob(
    id: string,
    userId: string,
    updates: Partial<RemediationJob>,
  ): Promise<RemediationJob | undefined> {
    const { id: _i, userId: _u, createdAt: _c, ...rest } = updates as any;
    const [row] = await db
      .update(remediationJobs)
      .set({ ...rest, updatedAt: new Date() })
      .where(and(eq(remediationJobs.id, id), eq(remediationJobs.userId, userId)))
      .returning();
    return row;
  }

  async getRemediationJob(id: string, userId: string): Promise<RemediationJob | undefined> {
    const row = await db
      .select()
      .from(remediationJobs)
      .where(and(eq(remediationJobs.id, id), eq(remediationJobs.userId, userId)))
      .limit(1);
    return row[0];
  }

  async listRemediationJobsForScan(
    userId: string,
    scanType: string,
    scanId: string,
  ): Promise<RemediationJob[]> {
    return db
      .select()
      .from(remediationJobs)
      .where(
        and(
          eq(remediationJobs.userId, userId),
          eq(remediationJobs.scanType, scanType),
          eq(remediationJobs.scanId, scanId),
        ),
      )
      .orderBy(desc(remediationJobs.createdAt));
  }

  async getShieldAdvisorConversation(
    userId: string,
    findingId: string,
    scanType: string,
    scanId: string,
  ): Promise<ShieldAdvisorConversation | undefined> {
    const row = await db
      .select()
      .from(shieldAdvisorConversations)
      .where(
        and(
          eq(shieldAdvisorConversations.userId, userId),
          eq(shieldAdvisorConversations.findingId, findingId),
          eq(shieldAdvisorConversations.scanType, scanType),
          eq(shieldAdvisorConversations.scanId, scanId),
        ),
      )
      .limit(1);
    return row[0];
  }

  async upsertShieldAdvisorConversation(data: {
    userId: string;
    findingId: string;
    scanType: string;
    scanId: string;
    provider: string;
    messages: { role: string; content: string }[];
  }): Promise<ShieldAdvisorConversation> {
    const existing = await this.getShieldAdvisorConversation(
      data.userId,
      data.findingId,
      data.scanType,
      data.scanId,
    );
    if (existing) {
      const [row] = await db
        .update(shieldAdvisorConversations)
        .set({
          provider: data.provider,
          messages: data.messages,
          updatedAt: new Date(),
        })
        .where(eq(shieldAdvisorConversations.id, existing.id))
        .returning();
      return row;
    }
    const [row] = await db
      .insert(shieldAdvisorConversations)
      .values({
        userId: data.userId,
        findingId: data.findingId,
        scanType: data.scanType,
        scanId: data.scanId,
        provider: data.provider,
        messages: data.messages,
      })
      .returning();
    return row;
  }

  async updateUserShieldAdvisorProvider(userId: string, provider: string): Promise<User | undefined> {
    return this.updateUser(userId, { shieldAdvisorProvider: provider });
  }

  // Findings operations
  async getAllFindings(userId: string, includeArchived = false): Promise<any[]> {
    const [mvpIds, mobileIds, webIds] = await Promise.all([
      this.getAccessibleMvpScanIds(userId),
      this.getAccessibleMobileScanIds(userId),
      this.getAccessibleWebScanIds(userId),
    ]);
    const visibilityParts: SQL[] = [eq(findings.userId, userId)];
    for (const id of mvpIds) {
      visibilityParts.push(and(eq(findings.scanType, "mvp"), eq(findings.scanId, id))!);
    }
    for (const id of mobileIds) {
      visibilityParts.push(and(eq(findings.scanType, "mobile"), eq(findings.scanId, id))!);
    }
    for (const id of webIds) {
      visibilityParts.push(and(eq(findings.scanType, "web"), eq(findings.scanId, id))!);
    }
    const visibility = visibilityParts.length === 1 ? visibilityParts[0]! : or(...visibilityParts)!;
    const baseWhere = includeArchived
      ? visibility
      : and(visibility, eq(findings.isArchived, false));
    const findingsData = await db.select().from(findings).where(baseWhere!);
    
    // Enrich findings with scan/project names and scan creation timestamps
    const enrichedFindings = await Promise.all(
      findingsData.map(async (finding) => {
        let scanName = "Unknown";
        let scanCreatedAt: Date | null = null;
        
        if (finding.scanId && finding.scanType) {
          try {
            if (finding.scanType === "mvp") {
              const scan = await this.getMvpCodeScan(finding.scanId, userId);
              scanName = scan?.projectName || "Unknown MVP Project";
              scanCreatedAt = scan?.createdAt || null;
            } else if (finding.scanType === "mobile") {
              const scan = await this.getMobileAppScan(finding.scanId, userId);
              scanName = scan?.appName || "Unknown Mobile App";
              scanCreatedAt = scan?.createdAt || null;
            } else if (finding.scanType === "web") {
              const scan = await this.getWebAppScan(finding.scanId, userId);
              scanName = scan?.appName || "Unknown Web App";
              scanCreatedAt = scan?.createdAt || null;
            }
          } catch (error) {
            console.error(`Error fetching scan name for finding ${finding.id}:`, error);
          }
        }
        
        return {
          ...finding,
          scanName,
          scanCreatedAt,
        };
      })
    );
    
    return enrichedFindings;
  }

  async getFindingsByScan(scanId: string, userId: string, scanType: string): Promise<Finding[]> {
    const canRead = await this.userCanReadScanByType(userId, scanType, scanId);
    if (!canRead) {
      return [];
    }
    return db
      .select()
      .from(findings)
      .where(
        and(
          eq(findings.scanId, scanId),
          eq(findings.scanType, scanType),
          eq(findings.isArchived, false),
        ),
      );
  }

  async getFinding(id: string, userId: string): Promise<Finding | undefined> {
    const result = await db.select().from(findings).where(eq(findings.id, id)).limit(1);
    const f = result[0];
    if (!f || !(await this.userCanReadFindingRow(userId, f))) {
      return undefined;
    }
    return f;
  }

  async createFinding(finding: InsertFinding): Promise<Finding> {
    // Calculate priority scores automatically using the prioritization engine
    const priorityScores = calculatePriorityScores({
      severity: finding.severity,
      cwe: finding.cwe,
      asset: finding.asset,
    });
    
    const findingWithPriority = {
      ...finding,
      ...priorityScores,
    };
    
    const result = await db.insert(findings).values(findingWithPriority).returning();
    const row = result[0];
    void import("./cveWatchlistService").then(({ processFindingForWatchlist }) => processFindingForWatchlist(row));
    dispatchWebhookEvent(row.userId, "finding.created", { findingId: row.id, title: row.title, severity: row.severity, category: row.category, scanType: row.scanType });
    return row;
  }

  async updateFinding(id: string, userId: string, updates: Partial<Finding>): Promise<Finding | undefined> {
    const existing = await db.select().from(findings).where(eq(findings.id, id)).limit(1);
    const f = existing[0];
    if (!f || !(await this.userCanWriteFindingRow(userId, f))) {
      return undefined;
    }
    const { resolvedAt: _clientResolvedAt, ...rest } = updates;
    const patch: Partial<Finding> = { ...rest };
    const nextStatus = (updates.status !== undefined ? updates.status : f.status) as string;
    const prevStatus = f.status as string;
    if (statusIsResolved(nextStatus) && !statusIsResolved(prevStatus)) {
      patch.resolvedAt = new Date();
    } else if (statusIsReopened(nextStatus) && statusIsResolved(prevStatus)) {
      patch.resolvedAt = null;
    }
    const result = await db.update(findings).set(patch).where(eq(findings.id, id)).returning();
    const updated = result[0];
    if (updated && statusIsResolved(nextStatus) && !statusIsResolved(prevStatus)) {
      dispatchWebhookEvent(updated.userId, "finding.resolved", { findingId: updated.id, title: updated.title, severity: updated.severity });
    }
    return updated;
  }

  async updateFindingsByScan(scanId: string, userId: string, updates: Partial<Finding>): Promise<void> {
    const sample = await db.select().from(findings).where(eq(findings.scanId, scanId)).limit(1);
    const scanType = sample[0]?.scanType;
    if (!scanType || !(await this.userCanWriteScanByType(userId, scanType, scanId))) {
      return;
    }
    await db.update(findings).set(updates).where(eq(findings.scanId, scanId));
  }

  async markFindingsAsFixed(scanId: string, scanType: string, userId: string): Promise<void> {
    if (!(await this.userCanWriteScanByType(userId, scanType, scanId))) {
      return;
    }
    await db
      .update(findings)
      .set({
        fixesApplied: true,
        status: "resolved",
        resolvedAt: new Date(),
      })
      .where(and(eq(findings.scanId, scanId), eq(findings.scanType, scanType)));
  }

  async archiveFinding(id: string, userId: string): Promise<Finding | undefined> {
    const existing = await db.select().from(findings).where(eq(findings.id, id)).limit(1);
    const f = existing[0];
    if (!f || !(await this.userCanWriteFindingRow(userId, f))) {
      return undefined;
    }
    const result = await db
      .update(findings)
      .set({
        isArchived: true,
        archivedAt: new Date(),
        status: "resolved",
        resolvedAt: new Date(),
      })
      .where(eq(findings.id, id))
      .returning();
    return result[0];
  }

  async restoreFinding(id: string, userId: string): Promise<Finding | undefined> {
    const existing = await db.select().from(findings).where(eq(findings.id, id)).limit(1);
    const f = existing[0];
    if (!f || !(await this.userCanWriteFindingRow(userId, f))) {
      return undefined;
    }
    const result = await db
      .update(findings)
      .set({
        isArchived: false,
        archivedAt: null,
        status: "open",
        resolvedAt: null,
      })
      .where(eq(findings.id, id))
      .returning();
    return result[0];
  }

  async getArchivedFindings(userId: string): Promise<Finding[]> {
    const [mvpIds, mobileIds, webIds] = await Promise.all([
      this.getAccessibleMvpScanIds(userId),
      this.getAccessibleMobileScanIds(userId),
      this.getAccessibleWebScanIds(userId),
    ]);
    const visibilityParts: SQL[] = [eq(findings.userId, userId)];
    for (const id of mvpIds) {
      visibilityParts.push(and(eq(findings.scanType, "mvp"), eq(findings.scanId, id))!);
    }
    for (const id of mobileIds) {
      visibilityParts.push(and(eq(findings.scanType, "mobile"), eq(findings.scanId, id))!);
    }
    for (const id of webIds) {
      visibilityParts.push(and(eq(findings.scanType, "web"), eq(findings.scanId, id))!);
    }
    const visibility = visibilityParts.length === 1 ? visibilityParts[0]! : or(...visibilityParts)!;
    return db
      .select()
      .from(findings)
      .where(and(visibility, eq(findings.isArchived, true)));
  }

  async cleanupOldArchivedFindings(): Promise<void> {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    await db
      .delete(findings)
      .where(
        and(
          eq(findings.isArchived, true),
          lt(findings.archivedAt, sixMonthsAgo)
        )
      );
  }

  async recalculatePriorityScores(): Promise<void> {
    // Get all findings
    const allFindings = await db.select().from(findings);
    
    // Update each finding with recalculated priority scores
    for (const finding of allFindings) {
      const priorityScores = calculatePriorityScores({
        severity: finding.severity,
        cwe: finding.cwe,
        asset: finding.asset,
      });
      
      await db
        .update(findings)
        .set(priorityScores)
        .where(eq(findings.id, finding.id));
    }
  }

  async getFindingCountsByScan(
    scanId: string,
    userId: string,
    scanType: string,
  ): Promise<{
    findingsCount: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
  }> {
    if (!(await this.userCanReadScanByType(userId, scanType, scanId))) {
      return {
        findingsCount: 0,
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
      };
    }
    const allFindings = await db
      .select()
      .from(findings)
      .where(
        and(
          eq(findings.scanId, scanId),
          eq(findings.scanType, scanType),
          eq(findings.isArchived, false),
        ),
      );
    
    // Aggregate counts by severity
    const counts = {
      findingsCount: allFindings.length,
      criticalCount: allFindings.filter(f => f.severity === 'CRITICAL').length,
      highCount: allFindings.filter(f => f.severity === 'HIGH').length,
      mediumCount: allFindings.filter(f => f.severity === 'MEDIUM').length,
      lowCount: allFindings.filter(f => f.severity === 'LOW').length,
    };
    
    return counts;
  }

  // Mobile App Scan operations
  async getAllMobileAppScans(userId: string): Promise<MobileAppScan[]> {
    const orgIds = await this.getOrganizationIdsForUser(userId);
    return db
      .select()
      .from(mobileAppScans)
      .where(this.mobileScanAccessWhere(userId, orgIds))
      .orderBy(desc(mobileAppScans.createdAt));
  }

  async getMobileAppScan(id: string, userId: string): Promise<MobileAppScan | undefined> {
    const result = await db.select().from(mobileAppScans).where(eq(mobileAppScans.id, id)).limit(1);
    const scan = result[0];
    if (!scan || !(await this.userCanReadMobileScan(userId, scan))) {
      return undefined;
    }
    return scan;
  }

  async createMobileAppScan(scan: InsertMobileAppScan & { organizationId?: string | null }): Promise<MobileAppScan> {
    const result = await db.insert(mobileAppScans).values(scan).returning();
    return result[0];
  }

  async updateMobileAppScan(id: string, userId: string, updates: Partial<MobileAppScan>): Promise<MobileAppScan | undefined> {
    const result = await db.select().from(mobileAppScans).where(eq(mobileAppScans.id, id)).limit(1);
    const scan = result[0];
    if (!scan || !(await this.userCanWriteMobileScan(userId, scan))) {
      return undefined;
    }
    const row = await db
      .update(mobileAppScans)
      .set(updates)
      .where(eq(mobileAppScans.id, id))
      .returning();
    return row[0];
  }

  async deleteMobileAppScan(id: string, userId: string): Promise<void> {
    const result = await db.select().from(mobileAppScans).where(eq(mobileAppScans.id, id)).limit(1);
    const scan = result[0];
    if (!scan || !(await this.userCanWriteMobileScan(userId, scan))) {
      return;
    }
    await db.delete(mobileAppScans).where(eq(mobileAppScans.id, id));
  }

  // MVP Code Scan operations
  async getAllMvpCodeScans(userId: string): Promise<MvpCodeScan[]> {
    const orgIds = await this.getOrganizationIdsForUser(userId);
    return db
      .select()
      .from(mvpCodeScans)
      .where(this.mvpScanAccessWhere(userId, orgIds))
      .orderBy(desc(mvpCodeScans.createdAt));
  }

  async getMvpCodeScan(id: string, userId: string): Promise<MvpCodeScan | undefined> {
    const result = await db.select().from(mvpCodeScans).where(eq(mvpCodeScans.id, id)).limit(1);
    const scan = result[0];
    if (!scan || !(await this.userCanReadMvpScan(userId, scan))) {
      return undefined;
    }
    return scan;
  }

  async createMvpCodeScan(scan: InsertMvpCodeScan & { organizationId?: string | null }): Promise<MvpCodeScan> {
    const result = await db.insert(mvpCodeScans).values(scan).returning();
    return result[0];
  }

  async updateMvpCodeScan(id: string, userId: string, updates: Partial<MvpCodeScan>): Promise<MvpCodeScan | undefined> {
    const result = await db.select().from(mvpCodeScans).where(eq(mvpCodeScans.id, id)).limit(1);
    const scan = result[0];
    if (!scan || !(await this.userCanWriteMvpScan(userId, scan))) {
      return undefined;
    }
    const row = await db
      .update(mvpCodeScans)
      .set(updates)
      .where(eq(mvpCodeScans.id, id))
      .returning();
    return row[0];
  }

  async deleteMvpCodeScan(id: string, userId: string): Promise<void> {
    const result = await db.select().from(mvpCodeScans).where(eq(mvpCodeScans.id, id)).limit(1);
    const scan = result[0];
    if (!scan || !(await this.userCanWriteMvpScan(userId, scan))) {
      return;
    }
    await db.delete(mvpCodeScans).where(eq(mvpCodeScans.id, id));
  }

  // Web App Scan operations
  async getAllWebAppScans(userId: string): Promise<WebAppScan[]> {
    const orgIds = await this.getOrganizationIdsForUser(userId);
    return db
      .select()
      .from(webAppScans)
      .where(this.webScanAccessWhere(userId, orgIds))
      .orderBy(desc(webAppScans.createdAt));
  }

  async getWebAppScan(id: string, userId: string): Promise<WebAppScan | undefined> {
    const result = await db.select().from(webAppScans).where(eq(webAppScans.id, id)).limit(1);
    const scan = result[0];
    if (!scan || !(await this.userCanReadWebScan(userId, scan))) {
      return undefined;
    }
    return scan;
  }

  async createWebAppScan(scan: InsertWebAppScan & { organizationId?: string | null }): Promise<WebAppScan> {
    const result = await db.insert(webAppScans).values(scan).returning();
    return result[0];
  }

  async updateWebAppScan(id: string, userId: string, updates: Partial<WebAppScan>): Promise<WebAppScan | undefined> {
    const result = await db.select().from(webAppScans).where(eq(webAppScans.id, id)).limit(1);
    const scan = result[0];
    if (!scan || !(await this.userCanWriteWebScan(userId, scan))) {
      return undefined;
    }
    const row = await db
      .update(webAppScans)
      .set(updates)
      .where(eq(webAppScans.id, id))
      .returning();
    return row[0];
  }

  async deleteWebAppScan(id: string, userId: string): Promise<void> {
    const result = await db.select().from(webAppScans).where(eq(webAppScans.id, id)).limit(1);
    const scan = result[0];
    if (!scan || !(await this.userCanWriteWebScan(userId, scan))) {
      return;
    }
    await db.delete(webAppScans).where(eq(webAppScans.id, id));
  }

  // Report operations
  async getAllReports(userId: string): Promise<Report[]> {
    return await db.select().from(reports).where(eq(reports.userId, userId));
  }

  async getReport(id: string, userId: string): Promise<Report | undefined> {
    const result = await db.select().from(reports).where(and(eq(reports.id, id), eq(reports.userId, userId)));
    return result[0];
  }

  async createReport(report: InsertReport): Promise<Report> {
    const result = await db.insert(reports).values(report).returning();
    return result[0];
  }

  async updateReport(id: string, userId: string, updates: Partial<Report>): Promise<Report | undefined> {
    const result = await db
      .update(reports)
      .set(updates)
      .where(and(eq(reports.id, id), eq(reports.userId, userId)))
      .returning();
    return result[0];
  }

  // Pipeline Scan operations
  async getAllPipelineScans(userId: string): Promise<PipelineScan[]> {
    return await db.select().from(pipelineScans).where(eq(pipelineScans.userId, userId));
  }

  async getPipelineScan(id: string, userId: string): Promise<PipelineScan | undefined> {
    const result = await db.select().from(pipelineScans).where(and(eq(pipelineScans.id, id), eq(pipelineScans.userId, userId)));
    return result[0];
  }

  async createPipelineScan(scan: InsertPipelineScan): Promise<PipelineScan> {
    const result = await db.insert(pipelineScans).values(scan).returning();
    return result[0];
  }

  async updatePipelineScan(id: string, userId: string, updates: Partial<PipelineScan>): Promise<PipelineScan | undefined> {
    const result = await db
      .update(pipelineScans)
      .set(updates)
      .where(and(eq(pipelineScans.id, id), eq(pipelineScans.userId, userId)))
      .returning();
    return result[0];
  }

  // Container Scan operations
  async getAllContainerScans(userId: string): Promise<ContainerScan[]> {
    return await db.select().from(containerScans).where(eq(containerScans.userId, userId));
  }

  async getContainerScan(id: string, userId: string): Promise<ContainerScan | undefined> {
    const result = await db.select().from(containerScans).where(and(eq(containerScans.id, id), eq(containerScans.userId, userId)));
    return result[0];
  }

  async createContainerScan(scan: InsertContainerScan): Promise<ContainerScan> {
    const result = await db.insert(containerScans).values(scan).returning();
    return result[0];
  }

  async updateContainerScan(id: string, userId: string, updates: Partial<ContainerScan>): Promise<ContainerScan | undefined> {
    const result = await db
      .update(containerScans)
      .set(updates)
      .where(and(eq(containerScans.id, id), eq(containerScans.userId, userId)))
      .returning();
    return result[0];
  }

  // Network Scan operations
  async getAllNetworkScans(userId: string): Promise<NetworkScan[]> {
    return await db.select().from(networkScans).where(eq(networkScans.userId, userId));
  }

  async getNetworkScan(id: string, userId: string): Promise<NetworkScan | undefined> {
    const result = await db.select().from(networkScans).where(and(eq(networkScans.id, id), eq(networkScans.userId, userId)));
    return result[0];
  }

  async createNetworkScan(scan: InsertNetworkScan): Promise<NetworkScan> {
    const result = await db.insert(networkScans).values(scan).returning();
    return result[0];
  }

  async updateNetworkScan(id: string, userId: string, updates: Partial<NetworkScan>): Promise<NetworkScan | undefined> {
    const result = await db
      .update(networkScans)
      .set(updates)
      .where(and(eq(networkScans.id, id), eq(networkScans.userId, userId)))
      .returning();
    return result[0];
  }

  // Linter Scan operations
  async getAllLinterScans(userId: string): Promise<LinterScan[]> {
    return await db.select().from(linterScans).where(eq(linterScans.userId, userId));
  }

  async getLinterScan(id: string, userId: string): Promise<LinterScan | undefined> {
    const result = await db.select().from(linterScans).where(and(eq(linterScans.id, id), eq(linterScans.userId, userId)));
    return result[0];
  }

  async createLinterScan(scan: InsertLinterScan): Promise<LinterScan> {
    const result = await db.insert(linterScans).values(scan).returning();
    return result[0];
  }

  async updateLinterScan(id: string, userId: string, updates: Partial<LinterScan>): Promise<LinterScan | undefined> {
    const result = await db
      .update(linterScans)
      .set(updates)
      .where(and(eq(linterScans.id, id), eq(linterScans.userId, userId)))
      .returning();
    return result[0];
  }

  // Linter Fix Batch operations
  async getAllLinterFixBatches(userId: string): Promise<LinterFixBatch[]> {
    return await db.select().from(linterFixBatches).where(eq(linterFixBatches.userId, userId));
  }

  async getLinterFixBatch(id: string, userId: string): Promise<LinterFixBatch | undefined> {
    const result = await db.select().from(linterFixBatches).where(and(eq(linterFixBatches.id, id), eq(linterFixBatches.userId, userId)));
    return result[0];
  }

  async getLinterFixBatchByScan(linterScanId: string, userId: string): Promise<LinterFixBatch[]> {
    return await db.select().from(linterFixBatches).where(and(eq(linterFixBatches.linterScanId, linterScanId), eq(linterFixBatches.userId, userId)));
  }

  async createLinterFixBatch(batch: InsertLinterFixBatch): Promise<LinterFixBatch> {
    const result = await db.insert(linterFixBatches).values(batch).returning();
    return result[0];
  }

  async updateLinterFixBatch(id: string, userId: string, updates: Partial<LinterFixBatch>): Promise<LinterFixBatch | undefined> {
    const result = await db
      .update(linterFixBatches)
      .set(updates)
      .where(and(eq(linterFixBatches.id, id), eq(linterFixBatches.userId, userId)))
      .returning();
    return result[0];
  }

  // Pipeline Fix Batch operations
  async getAllPipelineFixBatches(userId: string): Promise<PipelineFixBatch[]> {
    return await db.select().from(pipelineFixBatches).where(eq(pipelineFixBatches.userId, userId));
  }

  async getPipelineFixBatch(id: string, userId: string): Promise<PipelineFixBatch | undefined> {
    const result = await db.select().from(pipelineFixBatches).where(and(eq(pipelineFixBatches.id, id), eq(pipelineFixBatches.userId, userId)));
    return result[0];
  }

  async getPipelineFixBatchByScan(pipelineScanId: string, userId: string): Promise<PipelineFixBatch[]> {
    return await db.select().from(pipelineFixBatches).where(and(eq(pipelineFixBatches.pipelineScanId, pipelineScanId), eq(pipelineFixBatches.userId, userId)));
  }

  async createPipelineFixBatch(batch: InsertPipelineFixBatch): Promise<PipelineFixBatch> {
    const result = await db.insert(pipelineFixBatches).values(batch).returning();
    return result[0];
  }

  async updatePipelineFixBatch(id: string, userId: string, updates: Partial<PipelineFixBatch>): Promise<PipelineFixBatch | undefined> {
    const result = await db
      .update(pipelineFixBatches)
      .set(updates)
      .where(and(eq(pipelineFixBatches.id, id), eq(pipelineFixBatches.userId, userId)))
      .returning();
    return result[0];
  }

  // Network Fix Batch operations
  async getAllNetworkFixBatches(userId: string): Promise<NetworkFixBatch[]> {
    return await db.select().from(networkFixBatches).where(eq(networkFixBatches.userId, userId));
  }

  async getNetworkFixBatch(id: string, userId: string): Promise<NetworkFixBatch | undefined> {
    const result = await db.select().from(networkFixBatches).where(and(eq(networkFixBatches.id, id), eq(networkFixBatches.userId, userId)));
    return result[0];
  }

  async getNetworkFixBatchByScan(networkScanId: string, userId: string): Promise<NetworkFixBatch[]> {
    return await db.select().from(networkFixBatches).where(and(eq(networkFixBatches.networkScanId, networkScanId), eq(networkFixBatches.userId, userId)));
  }

  async createNetworkFixBatch(batch: InsertNetworkFixBatch): Promise<NetworkFixBatch> {
    const result = await db.insert(networkFixBatches).values(batch).returning();
    return result[0];
  }

  async updateNetworkFixBatch(id: string, userId: string, updates: Partial<NetworkFixBatch>): Promise<NetworkFixBatch | undefined> {
    const result = await db
      .update(networkFixBatches)
      .set(updates)
      .where(and(eq(networkFixBatches.id, id), eq(networkFixBatches.userId, userId)))
      .returning();
    return result[0];
  }

  // Container Fix Batch operations
  async getAllContainerFixBatches(userId: string): Promise<ContainerFixBatch[]> {
    return await db.select().from(containerFixBatches).where(eq(containerFixBatches.userId, userId));
  }

  async getContainerFixBatch(id: string, userId: string): Promise<ContainerFixBatch | undefined> {
    const result = await db.select().from(containerFixBatches).where(and(eq(containerFixBatches.id, id), eq(containerFixBatches.userId, userId)));
    return result[0];
  }

  async getContainerFixBatchByScan(containerScanId: string, userId: string): Promise<ContainerFixBatch[]> {
    return await db.select().from(containerFixBatches).where(and(eq(containerFixBatches.containerScanId, containerScanId), eq(containerFixBatches.userId, userId)));
  }

  async createContainerFixBatch(batch: InsertContainerFixBatch): Promise<ContainerFixBatch> {
    const result = await db.insert(containerFixBatches).values(batch).returning();
    return result[0];
  }

  async updateContainerFixBatch(id: string, userId: string, updates: Partial<ContainerFixBatch>): Promise<ContainerFixBatch | undefined> {
    const result = await db
      .update(containerFixBatches)
      .set(updates)
      .where(and(eq(containerFixBatches.id, id), eq(containerFixBatches.userId, userId)))
      .returning();
    return result[0];
  }

  // Scheduled Scan operations
  async getAllScheduledScans(userId: string): Promise<ScheduledScan[]> {
    return await db.select().from(scheduledScans).where(eq(scheduledScans.userId, userId));
  }

  async getScheduledScan(id: string, userId: string): Promise<ScheduledScan | undefined> {
    const result = await db.select().from(scheduledScans).where(and(eq(scheduledScans.id, id), eq(scheduledScans.userId, userId)));
    return result[0];
  }

  async getDueScheduledScans(asOf: Date): Promise<ScheduledScan[]> {
    return db
      .select()
      .from(scheduledScans)
      .where(
        and(
          eq(scheduledScans.isActive, true),
          or(isNull(scheduledScans.nextRunAt), lte(scheduledScans.nextRunAt, asOf)),
        ),
      );
  }

  async claimScheduledScanRun(row: ScheduledScan, asOf: Date): Promise<ScheduledScan | undefined> {
    const nextRun = computeNextRunAt(asOf, row.frequency, row.cronExpression ?? undefined);
    const result = await db
      .update(scheduledScans)
      .set({
        lastRunAt: asOf,
        nextRunAt: nextRun,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(scheduledScans.id, row.id),
          eq(scheduledScans.isActive, true),
          row.nextRunAt == null
            ? isNull(scheduledScans.nextRunAt)
            : eq(scheduledScans.nextRunAt, row.nextRunAt),
        ),
      )
      .returning();
    return result[0];
  }

  async createScheduledScan(scan: InsertScheduledScan): Promise<ScheduledScan> {
    const result = await db.insert(scheduledScans).values(scan).returning();
    return result[0];
  }

  async updateScheduledScan(id: string, userId: string, updates: Partial<ScheduledScan>): Promise<ScheduledScan | undefined> {
    const result = await db
      .update(scheduledScans)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(eq(scheduledScans.id, id), eq(scheduledScans.userId, userId)))
      .returning();
    return result[0];
  }

  async deleteScheduledScan(id: string, userId: string): Promise<void> {
    await db.delete(scheduledScans).where(and(eq(scheduledScans.id, id), eq(scheduledScans.userId, userId)));
  }

  // Alert Settings operations
  async getAlertSettings(userId: string): Promise<AlertSettings | undefined> {
    const result = await db.select().from(alertSettings).where(eq(alertSettings.userId, userId)).limit(1);
    return result[0];
  }

  async updateAlertSettings(userId: string, settings: Partial<AlertSettings>): Promise<AlertSettings> {
    const existing = await this.getAlertSettings(userId);
    
    if (existing) {
      const result = await db
        .update(alertSettings)
        .set({
          ...settings,
          updatedAt: new Date(),
        })
        .where(eq(alertSettings.id, existing.id))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(alertSettings).values({
        ...settings,
        userId,
      } as InsertAlertSettings).returning();
      return result[0];
    }
  }

  // SSO Provider operations
  async getAllSsoProviders(): Promise<SsoProvider[]> {
    return await db.select().from(ssoProviders);
  }

  async getEnabledSsoProviders(): Promise<SsoProvider[]> {
    return await db.select().from(ssoProviders).where(eq(ssoProviders.enabled, true));
  }

  async getSsoProvider(id: string): Promise<SsoProvider | undefined> {
    const result = await db.select().from(ssoProviders).where(eq(ssoProviders.id, id));
    return result[0];
  }

  async createSsoProvider(provider: InsertSsoProvider): Promise<SsoProvider> {
    const result = await db.insert(ssoProviders).values(provider).returning();
    return result[0];
  }

  async updateSsoProvider(id: string, updates: Partial<SsoProvider>): Promise<SsoProvider | undefined> {
    const result = await db
      .update(ssoProviders)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(ssoProviders.id, id))
      .returning();
    return result[0];
  }

  async deleteSsoProvider(id: string): Promise<void> {
    await db.delete(ssoProviders).where(eq(ssoProviders.id, id));
  }

  // Terms of Service Acceptance operations
  async getToSAcceptance(userId: string): Promise<TermsOfServiceAcceptance | undefined> {
    const result = await db.select().from(termsOfServiceAcceptances).where(eq(termsOfServiceAcceptances.userId, userId));
    return result[0];
  }

  async createToSAcceptance(acceptance: InsertTermsOfServiceAcceptance): Promise<TermsOfServiceAcceptance> {
    const result = await db.insert(termsOfServiceAcceptances).values(acceptance).returning();
    return result[0];
  }

  async updateToSAcceptance(userId: string, updates: Partial<TermsOfServiceAcceptance>): Promise<TermsOfServiceAcceptance | undefined> {
    const result = await db
      .update(termsOfServiceAcceptances)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(termsOfServiceAcceptances.userId, userId))
      .returning();
    return result[0];
  }

  // Fix Validation Session operations
  async getFixValidationSession(id: string, userId: string): Promise<FixValidationSession | undefined> {
    const result = await db
      .select()
      .from(fixValidationSessions)
      .where(and(eq(fixValidationSessions.id, id), eq(fixValidationSessions.userId, userId)));
    return result[0];
  }

  async getFixValidationSessionByScan(scanId: string, userId: string): Promise<FixValidationSession | undefined> {
    const result = await db
      .select()
      .from(fixValidationSessions)
      .where(and(eq(fixValidationSessions.scanId, scanId), eq(fixValidationSessions.userId, userId)))
      .orderBy(sql`${fixValidationSessions.createdAt} DESC`)
      .limit(1);
    return result[0];
  }

  async createFixValidationSession(session: InsertFixValidationSession): Promise<FixValidationSession> {
    const result = await db.insert(fixValidationSessions).values(session).returning();
    return result[0];
  }

  async updateFixValidationSession(id: string, userId: string, updates: Partial<FixValidationSession>): Promise<FixValidationSession | undefined> {
    const result = await db
      .update(fixValidationSessions)
      .set(updates)
      .where(and(eq(fixValidationSessions.id, id), eq(fixValidationSessions.userId, userId)))
      .returning();
    return result[0];
  }

  // Automated Fix Job operations
  async getAutomatedFixJob(id: string, userId: string): Promise<AutomatedFixJob | undefined> {
    const result = await db
      .select()
      .from(automatedFixJobs)
      .where(and(eq(automatedFixJobs.id, id), eq(automatedFixJobs.userId, userId)));
    return result[0];
  }

  async getAutomatedFixJobBySession(sessionId: string, userId: string): Promise<AutomatedFixJob | undefined> {
    const result = await db
      .select()
      .from(automatedFixJobs)
      .where(and(eq(automatedFixJobs.sessionId, sessionId), eq(automatedFixJobs.userId, userId)))
      .orderBy(sql`${automatedFixJobs.createdAt} DESC`)
      .limit(1);
    return result[0];
  }

  async createAutomatedFixJob(job: InsertAutomatedFixJob): Promise<AutomatedFixJob> {
    const result = await db.insert(automatedFixJobs).values(job).returning();
    return result[0];
  }

  async updateAutomatedFixJob(id: string, userId: string, updates: Partial<AutomatedFixJob>): Promise<AutomatedFixJob | undefined> {
    const result = await db
      .update(automatedFixJobs)
      .set(updates)
      .where(and(eq(automatedFixJobs.id, id), eq(automatedFixJobs.userId, userId)))
      .returning();
    return result[0];
  }

  // Global Fix Job operations
  async getGlobalFixJob(id: string, userId: string): Promise<GlobalFixJob | undefined> {
    const result = await db
      .select()
      .from(globalFixJobs)
      .where(and(eq(globalFixJobs.id, id), eq(globalFixJobs.userId, userId)));
    return result[0];
  }

  async getAllGlobalFixJobs(userId: string): Promise<GlobalFixJob[]> {
    const result = await db
      .select()
      .from(globalFixJobs)
      .where(eq(globalFixJobs.userId, userId))
      .orderBy(desc(globalFixJobs.createdAt));
    return result;
  }

  async createGlobalFixJob(job: InsertGlobalFixJob): Promise<GlobalFixJob> {
    const result = await db.insert(globalFixJobs).values(job).returning();
    return result[0];
  }

  async updateGlobalFixJob(id: string, userId: string, updates: Partial<GlobalFixJob>): Promise<GlobalFixJob | undefined> {
    const result = await db
      .update(globalFixJobs)
      .set(updates)
      .where(and(eq(globalFixJobs.id, id), eq(globalFixJobs.userId, userId)))
      .returning();
    return result[0];
  }

  // Global Fix Scan Task operations
  async getGlobalFixScanTask(id: string, userId: string): Promise<GlobalFixScanTask | undefined> {
    const result = await db
      .select()
      .from(globalFixScanTasks)
      .where(and(eq(globalFixScanTasks.id, id), eq(globalFixScanTasks.userId, userId)));
    return result[0];
  }

  async getGlobalFixScanTasks(jobId: string, userId: string): Promise<GlobalFixScanTask[]> {
    const result = await db
      .select()
      .from(globalFixScanTasks)
      .where(and(eq(globalFixScanTasks.jobId, jobId), eq(globalFixScanTasks.userId, userId)))
      .orderBy(globalFixScanTasks.createdAt);
    return result;
  }

  async createGlobalFixScanTask(task: InsertGlobalFixScanTask): Promise<GlobalFixScanTask> {
    const result = await db.insert(globalFixScanTasks).values(task).returning();
    return result[0];
  }

  async updateGlobalFixScanTask(id: string, userId: string, updates: Partial<GlobalFixScanTask>): Promise<GlobalFixScanTask | undefined> {
    const result = await db
      .update(globalFixScanTasks)
      .set(updates)
      .where(and(eq(globalFixScanTasks.id, id), eq(globalFixScanTasks.userId, userId)))
      .returning();
    return result[0];
  }

  // Notification operations
  async getNotifications(userId: string, limit: number = 50): Promise<Notification[]> {
    const result = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(
        // Unread notifications first (read=false comes before read=true in SQL)
        notifications.read,
        // Then by most recent
        desc(notifications.createdAt)
      )
      .limit(limit);
    return result;
  }

  async getUnreadNotifications(userId: string): Promise<Notification[]> {
    const result = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)))
      .orderBy(desc(notifications.createdAt));
    return result;
  }

  async getNotification(id: string, userId: string): Promise<Notification | undefined> {
    const result = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
    return result[0];
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const result = await db.insert(notifications).values(notification).returning();
    return result[0];
  }

  async markNotificationAsRead(id: string, userId: string): Promise<Notification | undefined> {
    const result = await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();
    return result[0];
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
    return result[0]?.count || 0;
  }

  async listCveWatchlistEntries(userId: string): Promise<CveWatchlistEntry[]> {
    return db
      .select()
      .from(cveWatchlistEntries)
      .where(eq(cveWatchlistEntries.userId, userId))
      .orderBy(desc(cveWatchlistEntries.createdAt));
  }

  async createCveWatchlistEntry(
    userId: string,
    data: { cveId: string; note?: string | null },
  ): Promise<CveWatchlistEntry> {
    const result = await db
      .insert(cveWatchlistEntries)
      .values({
        userId,
        cveId: data.cveId.toUpperCase(),
        note: data.note ?? null,
      })
      .returning();
    return result[0];
  }

  async updateCveWatchlistEntry(
    id: string,
    userId: string,
    updates: Partial<{ note: string | null; enabled: boolean }>,
  ): Promise<CveWatchlistEntry | undefined> {
    const result = await db
      .update(cveWatchlistEntries)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(cveWatchlistEntries.id, id), eq(cveWatchlistEntries.userId, userId)))
      .returning();
    return result[0];
  }

  async deleteCveWatchlistEntry(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(cveWatchlistEntries)
      .where(and(eq(cveWatchlistEntries.id, id), eq(cveWatchlistEntries.userId, userId)))
      .returning({ id: cveWatchlistEntries.id });
    return result.length > 0;
  }

  async tryInsertCveWatchlistNotified(userId: string, findingId: string, cveId: string): Promise<boolean> {
    const cve = cveId.toUpperCase();
    const result = await db
      .insert(cveWatchlistNotified)
      .values({ userId, findingId, cveId: cve })
      .onConflictDoNothing()
      .returning({ id: cveWatchlistNotified.id });
    return result.length > 0;
  }

  private async expireStaleRiskExceptionsForUser(userId: string): Promise<void> {
    const now = new Date();
    const stale = await db
      .select()
      .from(riskExceptions)
      .where(
        and(
          eq(riskExceptions.userId, userId),
          eq(riskExceptions.status, "active"),
          isNotNull(riskExceptions.expiresAt),
          lt(riskExceptions.expiresAt, now),
        ),
      );
    for (const row of stale) {
      await db
        .update(riskExceptions)
        .set({ status: "revoked", revokedAt: now, updatedAt: now })
        .where(eq(riskExceptions.id, row.id));
      const f = await db.select().from(findings).where(eq(findings.id, row.findingId)).limit(1);
      const finding = f[0];
      if (finding && (finding.status ?? "").toLowerCase() === "accepted-risk") {
        await db.update(findings).set({ status: "open" }).where(eq(findings.id, row.findingId));
      }
    }
  }

  async listRiskExceptionsForUser(
    userId: string,
  ): Promise<(RiskException & { findingTitle: string; findingSeverity: string })[]> {
    await this.expireStaleRiskExceptionsForUser(userId);
    const rows = await db
      .select({
        id: riskExceptions.id,
        userId: riskExceptions.userId,
        findingId: riskExceptions.findingId,
        justification: riskExceptions.justification,
        expiresAt: riskExceptions.expiresAt,
        status: riskExceptions.status,
        revokedAt: riskExceptions.revokedAt,
        createdAt: riskExceptions.createdAt,
        updatedAt: riskExceptions.updatedAt,
        findingTitle: findings.title,
        findingSeverity: findings.severity,
      })
      .from(riskExceptions)
      .innerJoin(findings, eq(riskExceptions.findingId, findings.id))
      .where(eq(riskExceptions.userId, userId))
      .orderBy(desc(riskExceptions.createdAt));
    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      findingId: r.findingId,
      justification: r.justification,
      expiresAt: r.expiresAt,
      status: r.status,
      revokedAt: r.revokedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      findingTitle: r.findingTitle,
      findingSeverity: r.findingSeverity,
    }));
  }

  async createRiskException(
    userId: string,
    data: { findingId: string; justification: string; expiresAt?: Date | null },
  ): Promise<RiskException> {
    await this.expireStaleRiskExceptionsForUser(userId);
    const finding = await this.getFinding(data.findingId, userId);
    if (!finding) {
      throw new Error("RISK_EXCEPTION_FINDING_NOT_FOUND");
    }
    if (finding.isArchived) {
      throw new Error("RISK_EXCEPTION_FINDING_ARCHIVED");
    }
    if (statusIsResolved(finding.status) || finding.fixesApplied) {
      throw new Error("RISK_EXCEPTION_FINDING_RESOLVED");
    }
    const st = (finding.status ?? "").toLowerCase();
    if (st === "accepted-risk") {
      throw new Error("RISK_EXCEPTION_ALREADY_ACTIVE");
    }

    const now = new Date();
    const activeForFinding = await db
      .select()
      .from(riskExceptions)
      .where(and(eq(riskExceptions.findingId, data.findingId), eq(riskExceptions.status, "active")));
    for (const ex of activeForFinding) {
      const stillActive = !ex.expiresAt || ex.expiresAt > now;
      if (stillActive) {
        throw new Error("RISK_EXCEPTION_ALREADY_ACTIVE");
      }
    }

    const trimmed = data.justification.trim();
    if (!trimmed) {
      throw new Error("RISK_EXCEPTION_JUSTIFICATION_REQUIRED");
    }

    const result = await db
      .insert(riskExceptions)
      .values({
        userId,
        findingId: data.findingId,
        justification: trimmed,
        expiresAt: data.expiresAt ?? null,
      })
      .returning();
    const row = result[0];
    await db.update(findings).set({ status: "accepted-risk" }).where(eq(findings.id, data.findingId));
    return row;
  }

  async revokeRiskException(id: string, userId: string): Promise<RiskException | undefined> {
    await this.expireStaleRiskExceptionsForUser(userId);
    const existing = await db
      .select()
      .from(riskExceptions)
      .where(and(eq(riskExceptions.id, id), eq(riskExceptions.userId, userId)))
      .limit(1);
    const ex = existing[0];
    if (!ex || ex.status !== "active") {
      return undefined;
    }
    const now = new Date();
    const updated = await db
      .update(riskExceptions)
      .set({ status: "revoked", revokedAt: now, updatedAt: now })
      .where(eq(riskExceptions.id, id))
      .returning();
    const f = await db.select().from(findings).where(eq(findings.id, ex.findingId)).limit(1);
    if (f[0] && (f[0].status ?? "").toLowerCase() === "accepted-risk") {
      await db.update(findings).set({ status: "open" }).where(eq(findings.id, ex.findingId));
    }
    return updated[0];
  }

  async revokeActiveRiskExceptionForFinding(
    userId: string,
    findingId: string,
  ): Promise<RiskException | undefined> {
    await this.expireStaleRiskExceptionsForUser(userId);
    const rows = await db
      .select()
      .from(riskExceptions)
      .where(
        and(
          eq(riskExceptions.userId, userId),
          eq(riskExceptions.findingId, findingId),
          eq(riskExceptions.status, "active"),
        ),
      )
      .limit(1);
    const ex = rows[0];
    if (!ex) {
      return undefined;
    }
    return this.revokeRiskException(ex.id, userId);
  }

  // ── Secrets Rotation Workflow (P5-H3) ──────────────────────────────

  async listSecretsRotationTickets(userId: string): Promise<SecretsRotationTicket[]> {
    return db
      .select()
      .from(secretsRotationTickets)
      .where(eq(secretsRotationTickets.userId, userId))
      .orderBy(desc(secretsRotationTickets.createdAt));
  }

  async getSecretsRotationTicket(id: string, userId: string): Promise<SecretsRotationTicket | undefined> {
    const rows = await db
      .select()
      .from(secretsRotationTickets)
      .where(and(eq(secretsRotationTickets.id, id), eq(secretsRotationTickets.userId, userId)))
      .limit(1);
    return rows[0];
  }

  async createSecretsRotationTicket(
    userId: string,
    data: {
      secretName: string;
      secretType: string;
      location?: string | null;
      severity?: string;
      findingId?: string | null;
      notes?: string | null;
      secretsManager?: string | null;
    },
  ): Promise<SecretsRotationTicket> {
    const rows = await db
      .insert(secretsRotationTickets)
      .values({
        userId,
        secretName: data.secretName,
        secretType: data.secretType,
        location: data.location ?? null,
        severity: data.severity ?? "high",
        findingId: data.findingId ?? null,
        notes: data.notes ?? null,
        secretsManager: data.secretsManager ?? null,
        status: "open",
      })
      .returning();
    return rows[0];
  }

  async updateSecretsRotationTicket(
    id: string,
    userId: string,
    data: Partial<{
      status: string;
      stepRemovedFromCode: boolean;
      stepNewSecretGenerated: boolean;
      stepStoredInManager: boolean;
      stepAppConfigUpdated: boolean;
      stepOldSecretRevoked: boolean;
      stepVerified: boolean;
      notes: string | null;
      secretsManager: string | null;
    }>,
  ): Promise<SecretsRotationTicket | undefined> {
    const setObj: Record<string, unknown> = { updatedAt: new Date() };
    if (data.status !== undefined) setObj.status = data.status;
    if (data.stepRemovedFromCode !== undefined) setObj.stepRemovedFromCode = data.stepRemovedFromCode;
    if (data.stepNewSecretGenerated !== undefined) setObj.stepNewSecretGenerated = data.stepNewSecretGenerated;
    if (data.stepStoredInManager !== undefined) setObj.stepStoredInManager = data.stepStoredInManager;
    if (data.stepAppConfigUpdated !== undefined) setObj.stepAppConfigUpdated = data.stepAppConfigUpdated;
    if (data.stepOldSecretRevoked !== undefined) setObj.stepOldSecretRevoked = data.stepOldSecretRevoked;
    if (data.stepVerified !== undefined) setObj.stepVerified = data.stepVerified;
    if (data.notes !== undefined) setObj.notes = data.notes;
    if (data.secretsManager !== undefined) setObj.secretsManager = data.secretsManager;

    if (data.status === "rotated" && !setObj.rotatedAt) setObj.rotatedAt = new Date();
    if (data.status === "verified" && !setObj.verifiedAt) setObj.verifiedAt = new Date();

    const rows = await db
      .update(secretsRotationTickets)
      .set(setObj)
      .where(and(eq(secretsRotationTickets.id, id), eq(secretsRotationTickets.userId, userId)))
      .returning();
    return rows[0];
  }

  async deleteSecretsRotationTicket(id: string, userId: string): Promise<boolean> {
    const rows = await db
      .delete(secretsRotationTickets)
      .where(and(eq(secretsRotationTickets.id, id), eq(secretsRotationTickets.userId, userId)))
      .returning();
    return rows.length > 0;
  }

  async autoCreateSecretsRotationTickets(userId: string): Promise<{ created: number; skipped: number }> {
    const allFindings = await this.getAllFindings(userId, false);
    const secretFindings = allFindings.filter(
      (f) =>
        (f.cwe === "798" || f.category === "Code Security") &&
        f.title?.toLowerCase().includes("hardcoded") &&
        !f.isArchived,
    );

    const existing = await this.listSecretsRotationTickets(userId);
    const existingFindingIds = new Set(existing.map((t) => t.findingId).filter(Boolean));

    let created = 0;
    let skipped = 0;
    for (const finding of secretFindings) {
      if (existingFindingIds.has(finding.id)) {
        skipped++;
        continue;
      }
      const typeMatch = finding.title?.match(/Hardcoded\s+(.+?)\s+in/i);
      const secretType = typeMatch
        ? typeMatch[1].toLowerCase().replace(/\s+/g, "_")
        : "api_key";
      await this.createSecretsRotationTicket(userId, {
        secretName: finding.title ?? "Unknown Secret",
        secretType,
        location: finding.location ?? null,
        severity: (finding.severity ?? "high").toLowerCase(),
        findingId: finding.id,
      });
      created++;
    }
    return { created, skipped };
  }

  async getLearningProgress(userId: string): Promise<LearningProgress[]> {
    return db
      .select()
      .from(learningProgress)
      .where(eq(learningProgress.userId, userId))
      .orderBy(learningProgress.updatedAt);
  }

  async upsertLearningProgress(
    userId: string,
    contentId: string,
    contentType: string,
    updates: { completed?: boolean; lastSectionIndex?: number },
  ): Promise<LearningProgress> {
    const existing = await db
      .select()
      .from(learningProgress)
      .where(
        and(
          eq(learningProgress.userId, userId),
          eq(learningProgress.contentId, contentId),
          eq(learningProgress.contentType, contentType),
        ),
      );

    if (existing.length > 0) {
      const setObj: Record<string, any> = { updatedAt: new Date() };
      if (updates.completed !== undefined) {
        setObj.completed = updates.completed;
        if (updates.completed) setObj.completedAt = new Date();
      }
      if (updates.lastSectionIndex !== undefined) {
        setObj.lastSectionIndex = updates.lastSectionIndex;
      }
      const result = await db
        .update(learningProgress)
        .set(setObj)
        .where(eq(learningProgress.id, existing[0].id))
        .returning();
      return result[0];
    }

    const result = await db
      .insert(learningProgress)
      .values({
        userId,
        contentId,
        contentType,
        completed: updates.completed ?? false,
        completedAt: updates.completed ? new Date() : null,
        lastSectionIndex: updates.lastSectionIndex ?? 0,
      })
      .returning();
    return result[0];
  }
}

export const storage = new DbStorage();
