import { type User, type InsertUser, type Session, type InsertSession, type Finding, type InsertFinding, type MobileAppScan, type InsertMobileAppScan, type MvpCodeScan, type InsertMvpCodeScan, type WebAppScan, type InsertWebAppScan, type Report, type InsertReport, type PipelineScan, type InsertPipelineScan, type ContainerScan, type InsertContainerScan, type NetworkScan, type InsertNetworkScan, type LinterScan, type InsertLinterScan, type LinterFixBatch, type InsertLinterFixBatch, type PipelineFixBatch, type InsertPipelineFixBatch, type NetworkFixBatch, type InsertNetworkFixBatch, type ContainerFixBatch, type InsertContainerFixBatch, type ScheduledScan, type InsertScheduledScan, type AlertSettings, type InsertAlertSettings, type SsoProvider, type InsertSsoProvider, type TermsOfServiceAcceptance, type InsertTermsOfServiceAcceptance, type FixValidationSession, type InsertFixValidationSession, type AutomatedFixJob, type InsertAutomatedFixJob, type GlobalFixJob, type InsertGlobalFixJob, type GlobalFixScanTask, type InsertGlobalFixScanTask, type Notification, type InsertNotification } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { users, sessions, findings, mobileAppScans, mvpCodeScans, webAppScans, reports, pipelineScans, containerScans, networkScans, linterScans, linterFixBatches, pipelineFixBatches, networkFixBatches, containerFixBatches, scheduledScans, alertSettings, ssoProviders, termsOfServiceAcceptances, fixValidationSessions, automatedFixJobs, globalFixJobs, globalFixScanTasks, notifications } from "@shared/schema";
import { eq, and, lt, sql, desc } from "drizzle-orm";
import { calculatePriorityScores } from "./prioritization";

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
  getFindingCountsByScan(scanId: string, userId: string): Promise<{
    findingsCount: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
  }>;
  
  // Mobile App Scan operations
  getAllMobileAppScans(userId: string): Promise<MobileAppScan[]>;
  getMobileAppScan(id: string, userId: string): Promise<MobileAppScan | undefined>;
  createMobileAppScan(scan: InsertMobileAppScan): Promise<MobileAppScan>;
  updateMobileAppScan(id: string, userId: string, updates: Partial<MobileAppScan>): Promise<MobileAppScan | undefined>;
  deleteMobileAppScan(id: string, userId: string): Promise<void>;
  
  // MVP Code Scan operations
  getAllMvpCodeScans(userId: string): Promise<MvpCodeScan[]>;
  getMvpCodeScan(id: string, userId: string): Promise<MvpCodeScan | undefined>;
  createMvpCodeScan(scan: InsertMvpCodeScan): Promise<MvpCodeScan>;
  updateMvpCodeScan(id: string, userId: string, updates: Partial<MvpCodeScan>): Promise<MvpCodeScan | undefined>;
  deleteMvpCodeScan(id: string, userId: string): Promise<void>;
  
  // Web App Scan operations
  getAllWebAppScans(userId: string): Promise<WebAppScan[]>;
  getWebAppScan(id: string, userId: string): Promise<WebAppScan | undefined>;
  createWebAppScan(scan: InsertWebAppScan): Promise<WebAppScan>;
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

  // Findings operations
  async getAllFindings(userId: string, includeArchived = false): Promise<any[]> {
    const findingsData = includeArchived
      ? await db.select().from(findings).where(eq(findings.userId, userId))
      : await db.select().from(findings).where(and(eq(findings.userId, userId), eq(findings.isArchived, false)));
    
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
    const findingsData = await db.select().from(findings).where(
      and(
        eq(findings.userId, userId),
        eq(findings.scanId, scanId),
        eq(findings.scanType, scanType),
        eq(findings.isArchived, false)
      )
    );
    return findingsData;
  }

  async getFinding(id: string, userId: string): Promise<Finding | undefined> {
    const result = await db.select().from(findings).where(and(eq(findings.id, id), eq(findings.userId, userId)));
    return result[0];
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
    return result[0];
  }

  async updateFinding(id: string, userId: string, updates: Partial<Finding>): Promise<Finding | undefined> {
    const result = await db
      .update(findings)
      .set(updates)
      .where(and(eq(findings.id, id), eq(findings.userId, userId)))
      .returning();
    return result[0];
  }

  async updateFindingsByScan(scanId: string, userId: string, updates: Partial<Finding>): Promise<void> {
    await db
      .update(findings)
      .set(updates)
      .where(and(eq(findings.scanId, scanId), eq(findings.userId, userId)));
  }

  async markFindingsAsFixed(scanId: string, scanType: string, userId: string): Promise<void> {
    await db
      .update(findings)
      .set({ 
        fixesApplied: true,
        status: 'resolved'
      })
      .where(
        and(
          eq(findings.scanId, scanId),
          eq(findings.scanType, scanType),
          eq(findings.userId, userId)
        )
      );
  }

  async archiveFinding(id: string, userId: string): Promise<Finding | undefined> {
    const result = await db
      .update(findings)
      .set({ 
        isArchived: true, 
        archivedAt: new Date(),
        status: "resolved"
      })
      .where(and(eq(findings.id, id), eq(findings.userId, userId)))
      .returning();
    return result[0];
  }

  async restoreFinding(id: string, userId: string): Promise<Finding | undefined> {
    const result = await db
      .update(findings)
      .set({ 
        isArchived: false, 
        archivedAt: null,
        status: "open"
      })
      .where(and(eq(findings.id, id), eq(findings.userId, userId)))
      .returning();
    return result[0];
  }

  async getArchivedFindings(userId: string): Promise<Finding[]> {
    return await db.select().from(findings).where(and(eq(findings.userId, userId), eq(findings.isArchived, true)));
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

  async getFindingCountsByScan(scanId: string, userId: string): Promise<{
    findingsCount: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
  }> {
    // Use SQL aggregation for better performance
    const allFindings = await db
      .select()
      .from(findings)
      .where(
        and(
          eq(findings.scanId, scanId),
          eq(findings.userId, userId),
          eq(findings.isArchived, false)
        )
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
    return await db.select().from(mobileAppScans).where(eq(mobileAppScans.userId, userId)).orderBy(desc(mobileAppScans.createdAt));
  }

  async getMobileAppScan(id: string, userId: string): Promise<MobileAppScan | undefined> {
    const result = await db.select().from(mobileAppScans).where(and(eq(mobileAppScans.id, id), eq(mobileAppScans.userId, userId)));
    return result[0];
  }

  async createMobileAppScan(scan: InsertMobileAppScan): Promise<MobileAppScan> {
    const result = await db.insert(mobileAppScans).values(scan).returning();
    return result[0];
  }

  async updateMobileAppScan(id: string, userId: string, updates: Partial<MobileAppScan>): Promise<MobileAppScan | undefined> {
    const result = await db
      .update(mobileAppScans)
      .set(updates)
      .where(and(eq(mobileAppScans.id, id), eq(mobileAppScans.userId, userId)))
      .returning();
    return result[0];
  }

  async deleteMobileAppScan(id: string, userId: string): Promise<void> {
    await db
      .delete(mobileAppScans)
      .where(and(eq(mobileAppScans.id, id), eq(mobileAppScans.userId, userId)));
  }

  // MVP Code Scan operations
  async getAllMvpCodeScans(userId: string): Promise<MvpCodeScan[]> {
    return await db.select().from(mvpCodeScans).where(eq(mvpCodeScans.userId, userId)).orderBy(desc(mvpCodeScans.createdAt));
  }

  async getMvpCodeScan(id: string, userId: string): Promise<MvpCodeScan | undefined> {
    const result = await db.select().from(mvpCodeScans).where(and(eq(mvpCodeScans.id, id), eq(mvpCodeScans.userId, userId)));
    return result[0];
  }

  async createMvpCodeScan(scan: InsertMvpCodeScan): Promise<MvpCodeScan> {
    const result = await db.insert(mvpCodeScans).values(scan).returning();
    return result[0];
  }

  async updateMvpCodeScan(id: string, userId: string, updates: Partial<MvpCodeScan>): Promise<MvpCodeScan | undefined> {
    const result = await db
      .update(mvpCodeScans)
      .set(updates)
      .where(and(eq(mvpCodeScans.id, id), eq(mvpCodeScans.userId, userId)))
      .returning();
    return result[0];
  }

  async deleteMvpCodeScan(id: string, userId: string): Promise<void> {
    await db
      .delete(mvpCodeScans)
      .where(and(eq(mvpCodeScans.id, id), eq(mvpCodeScans.userId, userId)));
  }

  // Web App Scan operations
  async getAllWebAppScans(userId: string): Promise<WebAppScan[]> {
    return await db.select().from(webAppScans).where(eq(webAppScans.userId, userId)).orderBy(desc(webAppScans.createdAt));
  }

  async getWebAppScan(id: string, userId: string): Promise<WebAppScan | undefined> {
    const result = await db.select().from(webAppScans).where(and(eq(webAppScans.id, id), eq(webAppScans.userId, userId)));
    return result[0];
  }

  async createWebAppScan(scan: InsertWebAppScan): Promise<WebAppScan> {
    const result = await db.insert(webAppScans).values(scan).returning();
    return result[0];
  }

  async updateWebAppScan(id: string, userId: string, updates: Partial<WebAppScan>): Promise<WebAppScan | undefined> {
    const result = await db
      .update(webAppScans)
      .set(updates)
      .where(and(eq(webAppScans.id, id), eq(webAppScans.userId, userId)))
      .returning();
    return result[0];
  }

  async deleteWebAppScan(id: string, userId: string): Promise<void> {
    await db
      .delete(webAppScans)
      .where(and(eq(webAppScans.id, id), eq(webAppScans.userId, userId)));
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
}

export const storage = new DbStorage();
