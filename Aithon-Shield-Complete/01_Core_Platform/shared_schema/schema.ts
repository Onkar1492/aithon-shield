import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  // Subscription tracking
  subscriptionTier: text("subscription_tier").notNull().default('free'), // 'free', 'pro', 'enterprise'
  subscriptionStatus: text("subscription_status").notNull().default('active'), // 'active', 'canceled', 'past_due'
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  // Push notification preferences
  pushNotificationsEnabled: boolean("push_notifications_enabled").notNull().default(true),
  notifyOnScanStart: boolean("notify_on_scan_start").notNull().default(true),
  notifyOnScanComplete: boolean("notify_on_scan_complete").notNull().default(true),
  notifyOnFixesApplied: boolean("notify_on_fixes_applied").notNull().default(true),
  notifyOnUpload: boolean("notify_on_upload").notNull().default(true),
  pushSubscription: text("push_subscription"), // JSON string of Web Push subscription
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const sessions = pgTable("sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;

export const insertSessionSchema = createInsertSchema(sessions).omit({
  id: true,
  createdAt: true,
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  firstName: true,
  lastName: true,
  username: true,
  password: true,
});

export const signUpSchema = insertUserSchema.extend({
  email: z.string().email("Invalid email address"),
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  emailOrUsername: z.string().min(1, "Email or username is required"),
  password: z.string().min(1, "Password is required"),
});

export const updateProfileSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters").optional(),
  lastName: z.string().min(2, "Last name must be at least 2 characters").optional(),
  email: z.string().email("Invalid email address").optional(),
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
});

export const updateNotificationsSchema = z.object({
  pushNotificationsEnabled: z.boolean().optional(),
  notifyOnScanStart: z.boolean().optional(),
  notifyOnScanComplete: z.boolean().optional(),
  notifyOnFixesApplied: z.boolean().optional(),
  notifyOnUpload: z.boolean().optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type SignUp = z.infer<typeof signUpSchema>;
export type Login = z.infer<typeof loginSchema>;
export type UpdateProfile = z.infer<typeof updateProfileSchema>;
export type UpdateNotifications = z.infer<typeof updateNotificationsSchema>;
export type User = typeof users.$inferSelect;

export const findings = pgTable("findings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  severity: text("severity").notNull(),
  category: text("category").notNull(),
  asset: text("asset").notNull(),
  cwe: text("cwe").notNull(),
  detected: text("detected").notNull(),
  status: text("status").notNull(),
  location: text("location"),
  remediation: text("remediation"),
  aiSuggestion: text("ai_suggestion"),
  riskScore: integer("risk_score").notNull(),
  // Auto-Prioritization Engine fields
  exploitabilityScore: integer("exploitability_score").notNull().default(0), // 0-100: How easy to exploit
  impactScore: integer("impact_score").notNull().default(0), // 0-100: Business impact if exploited
  attackSurfaceScore: integer("attack_surface_score").notNull().default(0), // 0-100: Exposure level
  priorityScore: integer("priority_score").notNull().default(0), // 0-100: Overall priority (calculated)
  // Scan tracking
  scanId: varchar("scan_id"), // ID of the scan that generated this finding
  scanType: text("scan_type"), // Type of scan: 'mvp', 'mobile', 'web', 'pipeline', 'container', 'network', 'linter'
  fixesApplied: boolean("fixes_applied").default(false), // Whether fixes were applied during the scan workflow
  // Source tracking
  source: text("source").notNull(), // 'mvp-scan', 'mobile-scan', 'web-scan', etc.
  mvpScanId: varchar("mvp_scan_id"),
  mobileScanId: varchar("mobile_scan_id"),
  webScanId: varchar("web_scan_id"),
  pipelineScanId: varchar("pipeline_scan_id"),
  containerScanId: varchar("container_scan_id"),
  networkScanId: varchar("network_scan_id"),
  linterScanId: varchar("linter_scan_id"),
  isArchived: boolean("is_archived").notNull().default(false),
  archivedAt: timestamp("archived_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertFindingSchema = createInsertSchema(findings).omit({
  id: true,
  isArchived: true,
  archivedAt: true,
  createdAt: true,
}).extend({
  scanId: z.string().optional(),
  scanType: z.string().optional(),
  fixesApplied: z.boolean().optional(),
});

export type InsertFinding = z.infer<typeof insertFindingSchema>;
export type Finding = typeof findings.$inferSelect;

export const mobileAppScans = pgTable("mobile_app_scans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(), // 'ios' or 'android'
  appId: text("app_id").notNull(), // Bundle ID for iOS, Package name for Android
  appName: text("app_name").notNull(),
  version: text("version").notNull(),
  // Authentication credentials for testing authenticated app areas
  authRequired: boolean("auth_required").notNull().default(false),
  authType: text("auth_type"), // 'basic', 'form', 'oauth', 'api-key', 'none'
  authUsername: text("auth_username"),
  authPassword: text("auth_password"), // Encrypted
  authLoginUrl: text("auth_login_url"),
  authApiKey: text("auth_api_key"), // Encrypted
  authTokenHeader: text("auth_token_header"), // e.g., 'Authorization', 'X-API-Key'
  scanStatus: text("scan_status").notNull().default('pending'), // 'pending', 'scanning', 'completed', 'failed'
  uploadStatus: text("upload_status").notNull().default('none'), // 'none', 'pending', 'uploaded', 'failed'
  uploadProgress: text("upload_progress").notNull().default('idle'), // 'idle', 'connecting', 'uploading', 'finalizing'
  testStatus: text("test_status").notNull().default('not_tested'), // 'not_tested', 'running', 'passed', 'failed'
  testSummary: text("test_summary"),
  testDetails: text("test_details"), // JSON with detailed test results
  testedAt: timestamp("tested_at"),
  findingsCount: integer("findings_count").notNull().default(0),
  criticalCount: integer("critical_count").notNull().default(0),
  highCount: integer("high_count").notNull().default(0),
  mediumCount: integer("medium_count").notNull().default(0),
  lowCount: integer("low_count").notNull().default(0),
  // Remediation Workflow Tracking
  fixesApplied: boolean("fixes_applied").notNull().default(false),
  uploadPreference: text("upload_preference").notNull().default('none'),
  validationStatus: text("validation_status").default('none'),
  validationFindings: jsonb("validation_findings"),
  autoUploadDestination: text("auto_upload_destination"),
  scannedAt: timestamp("scanned_at"),
  uploadedAt: timestamp("uploaded_at"),
  validatedAt: timestamp("validated_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertMobileAppScanSchema = createInsertSchema(mobileAppScans).omit({
  id: true,
  createdAt: true,
}).extend({
  scannedAt: z.coerce.date().optional(),
  uploadedAt: z.coerce.date().optional(),
});

export const updateMobileAppScanSchema = z.object({
  appName: z.string().min(1, "App name is required").optional(),
  appId: z.string().min(1, "App ID is required").optional(),
  version: z.string().min(1, "Version is required").optional(),
  fixesApplied: z.boolean().optional(),
  uploadPreference: z.string().optional(),
  autoUploadDestination: z.string().optional(),
});

export type InsertMobileAppScan = z.infer<typeof insertMobileAppScanSchema>;
export type UpdateMobileAppScan = z.infer<typeof updateMobileAppScanSchema>;
export type MobileAppScan = typeof mobileAppScans.$inferSelect;

export const mvpCodeScans = pgTable("mvp_code_scans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(), // 'github', 'replit', 'bolt', 'v0', 'lovable', 'other'
  repositoryUrl: text("repository_url").notNull(),
  projectName: text("project_name").notNull(),
  branch: text("branch").notNull().default('main'),
  // Authentication credentials for testing deployed app
  authRequired: boolean("auth_required").notNull().default(false),
  authType: text("auth_type"), // 'basic', 'form', 'oauth', 'api-key', 'none'
  authUsername: text("auth_username"),
  authPassword: text("auth_password"), // Encrypted
  authLoginUrl: text("auth_login_url"),
  authApiKey: text("auth_api_key"), // Encrypted
  authTokenHeader: text("auth_token_header"), // e.g., 'Authorization', 'X-API-Key'
  scanStatus: text("scan_status").notNull().default('pending'), // 'pending', 'scanning', 'completed', 'failed'
  uploadStatus: text("upload_status").notNull().default('none'), // 'none', 'pending', 'uploaded', 'failed'
  uploadProgress: text("upload_progress").notNull().default('idle'), // 'idle', 'connecting', 'uploading', 'finalizing'
  testStatus: text("test_status").notNull().default('not_tested'), // 'not_tested', 'running', 'passed', 'failed'
  testSummary: text("test_summary"),
  testDetails: text("test_details"), // JSON with detailed test results
  testedAt: timestamp("tested_at"),
  findingsCount: integer("findings_count").notNull().default(0),
  criticalCount: integer("critical_count").notNull().default(0),
  highCount: integer("high_count").notNull().default(0),
  mediumCount: integer("medium_count").notNull().default(0),
  lowCount: integer("low_count").notNull().default(0),
  // App Store Upload Options
  targetAppStore: text("target_app_store"), // 'ios', 'android', or null
  appStoreBundleId: text("app_store_bundle_id"), // Bundle ID (iOS) or Package Name (Android)
  appStoreUploadStatus: text("app_store_upload_status").default('none'), // 'none', 'pending', 'uploaded', 'failed'
  appStoreUploadProgress: text("app_store_upload_progress").default('idle'), // 'idle', 'connecting', 'uploading', 'finalizing'
  // Preview
  previewUrl: text("preview_url"), // URL for QR code preview
  // Remediation Workflow Tracking
  fixesApplied: boolean("fixes_applied").notNull().default(false), // Whether user chose to apply fixes
  uploadPreference: text("upload_preference").notNull().default('none'), // 'fix-and-upload', 'upload-without-fixes', 'none'
  validationStatus: text("validation_status").default('none'), // 'none', 'pending', 'running', 'passed', 'failed', 'blocked'
  validationFindings: jsonb("validation_findings"), // JSON object with validation issues
  autoUploadDestination: text("auto_upload_destination"), // Destination info for re-upload
  scannedAt: timestamp("scanned_at"),
  uploadedAt: timestamp("uploaded_at"),
  validatedAt: timestamp("validated_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertMvpCodeScanSchema = createInsertSchema(mvpCodeScans).omit({
  id: true,
  createdAt: true,
}).extend({
  scannedAt: z.coerce.date().optional(),
  uploadedAt: z.coerce.date().optional(),
});

export const updateMvpCodeScanSchema = z.object({
  projectName: z.string().min(1, "Project name is required").optional(),
  repositoryUrl: z.string().url("Must be a valid URL").optional(),
  branch: z.string().min(1, "Branch is required").optional(),
  fixesApplied: z.boolean().optional(),
  uploadPreference: z.string().optional(),
  autoUploadDestination: z.string().optional(),
});

export type InsertMvpCodeScan = z.infer<typeof insertMvpCodeScanSchema>;
export type UpdateMvpCodeScan = z.infer<typeof updateMvpCodeScanSchema>;
export type MvpCodeScan = typeof mvpCodeScans.$inferSelect;

export const webAppScans = pgTable("web_app_scans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  appUrl: text("app_url").notNull(),
  appName: text("app_name").notNull(),
  hostingPlatform: text("hosting_platform").notNull(), // 'replit', 'vercel', 'netlify', 'heroku', 'aws', 'other'
  scanDepth: text("scan_depth").notNull().default('standard'), // 'quick', 'standard', 'comprehensive'
  // Authentication credentials for testing authenticated areas
  authRequired: boolean("auth_required").notNull().default(false),
  authType: text("auth_type"), // 'basic', 'form', 'oauth', 'api-key', 'none'
  authUsername: text("auth_username"),
  authPassword: text("auth_password"), // Encrypted
  authLoginUrl: text("auth_login_url"),
  authApiKey: text("auth_api_key"), // Encrypted
  authTokenHeader: text("auth_token_header"), // e.g., 'Authorization', 'X-API-Key'
  scanStatus: text("scan_status").notNull().default('pending'), // 'pending', 'scanning', 'completed', 'failed'
  uploadStatus: text("upload_status").notNull().default('none'), // 'none', 'pending', 'uploaded', 'failed'
  uploadProgress: text("upload_progress").notNull().default('idle'), // 'idle', 'connecting', 'uploading', 'finalizing'
  testStatus: text("test_status").notNull().default('not_tested'), // 'not_tested', 'running', 'passed', 'failed'
  testSummary: text("test_summary"),
  testDetails: text("test_details"), // JSON with detailed test results
  testedAt: timestamp("tested_at"),
  findingsCount: integer("findings_count").notNull().default(0),
  criticalCount: integer("critical_count").notNull().default(0),
  highCount: integer("high_count").notNull().default(0),
  mediumCount: integer("medium_count").notNull().default(0),
  lowCount: integer("low_count").notNull().default(0),
  // Remediation Workflow Tracking
  fixesApplied: boolean("fixes_applied").notNull().default(false),
  uploadPreference: text("upload_preference").notNull().default('none'),
  validationStatus: text("validation_status").default('none'),
  validationFindings: jsonb("validation_findings"),
  autoUploadDestination: text("auto_upload_destination"),
  scannedAt: timestamp("scanned_at"),
  uploadedAt: timestamp("uploaded_at"),
  validatedAt: timestamp("validated_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertWebAppScanSchema = createInsertSchema(webAppScans).omit({
  id: true,
  createdAt: true,
}).extend({
  scannedAt: z.coerce.date().optional(),
  uploadedAt: z.coerce.date().optional(),
});

export const updateWebAppScanSchema = z.object({
  appName: z.string().min(1, "App name is required").optional(),
  appUrl: z.string().url("Must be a valid URL").optional(),
  fixesApplied: z.boolean().optional(),
  uploadPreference: z.string().optional(),
  autoUploadDestination: z.string().optional(),
});

export type InsertWebAppScan = z.infer<typeof insertWebAppScanSchema>;
export type UpdateWebAppScan = z.infer<typeof updateWebAppScanSchema>;
export type WebAppScan = typeof webAppScans.$inferSelect;

export const reports = pgTable("reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'executive', 'technical', 'compliance'
  scanIds: text("scan_ids").array(), // Array of scan IDs included in report
  totalFindings: integer("total_findings").notNull().default(0),
  criticalCount: integer("critical_count").notNull().default(0),
  highCount: integer("high_count").notNull().default(0),
  mediumCount: integer("medium_count").notNull().default(0),
  lowCount: integer("low_count").notNull().default(0),
  status: text("status").notNull().default('pending'), // 'pending', 'generated', 'failed'
  generatedAt: timestamp("generated_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertReportSchema = createInsertSchema(reports).omit({
  id: true,
  createdAt: true,
  generatedAt: true,
});

export type InsertReport = z.infer<typeof insertReportSchema>;
export type Report = typeof reports.$inferSelect;

export const pipelineScans = pgTable("pipeline_scans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(), // 'github', 'gitlab', 'jenkins', 'azure-devops'
  repositoryUrl: text("repository_url").notNull(),
  repositoryName: text("repository_name").notNull(),
  branch: text("branch").notNull().default('main'),
  accessToken: text("access_token"), // Encrypted token for pipeline access
  scanStatus: text("scan_status").notNull().default('pending'), // 'pending', 'scanning', 'completed', 'failed'
  findingsCount: integer("findings_count").notNull().default(0),
  criticalCount: integer("critical_count").notNull().default(0),
  highCount: integer("high_count").notNull().default(0),
  mediumCount: integer("medium_count").notNull().default(0),
  lowCount: integer("low_count").notNull().default(0),
  // Fix workflow tracking
  fixesApplied: boolean("fixes_applied").default(false),
  uploadPreference: text("upload_preference"), // 'fix-and-upload', 'upload-without-fixes', null
  autoUploadDestination: text("auto_upload_destination"), // Repository URL where fixes are uploaded
  lastValidationStatus: text("last_validation_status"), // 'pass', 'fail', 'pending', null
  lastUploadStatus: text("last_upload_status"), // 'success', 'failed', 'pending', null
  scannedAt: timestamp("scanned_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertPipelineScanSchema = createInsertSchema(pipelineScans).omit({
  id: true,
  createdAt: true,
  accessToken: true, // Security: never persist access tokens
}).extend({
  scannedAt: z.coerce.date().optional(),
});

export const updatePipelineScanSchema = insertPipelineScanSchema.partial().extend({
  scannedAt: z.coerce.date().optional(), // Accept ISO string and convert to Date
});

export type InsertPipelineScan = z.infer<typeof insertPipelineScanSchema>;
export type UpdatePipelineScan = z.infer<typeof updatePipelineScanSchema>;
export type PipelineScan = typeof pipelineScans.$inferSelect;

export const containerScans = pgTable("container_scans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  scanType: text("scan_type").notNull(), // 'docker-image', 'kubernetes-deployment'
  imageName: text("image_name").notNull(),
  imageTag: text("image_tag").notNull().default('latest'),
  registry: text("registry").notNull(), // 'docker-hub', 'gcr', 'ecr', 'acr', 'custom'
  registryUrl: text("registry_url"), // Custom registry URL
  scanStatus: text("scan_status").notNull().default('pending'), // 'pending', 'scanning', 'completed', 'failed'
  findingsCount: integer("findings_count").notNull().default(0),
  criticalCount: integer("critical_count").notNull().default(0),
  highCount: integer("high_count").notNull().default(0),
  mediumCount: integer("medium_count").notNull().default(0),
  lowCount: integer("low_count").notNull().default(0),
  // Fix workflow tracking
  fixesApplied: boolean("fixes_applied").default(false),
  lastValidationStatus: text("last_validation_status"), // 'pass', 'fail', 'pending', null
  scannedAt: timestamp("scanned_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertContainerScanSchema = createInsertSchema(containerScans).omit({
  id: true,
  createdAt: true,
}).extend({
  scannedAt: z.coerce.date().optional(),
});

export type InsertContainerScan = z.infer<typeof insertContainerScanSchema>;
export type ContainerScan = typeof containerScans.$inferSelect;

export const networkScans = pgTable("network_scans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  targetHost: text("target_host").notNull(),
  targetName: text("target_name").notNull(),
  scanType: text("scan_type").notNull().default('comprehensive'), // 'quick', 'standard', 'comprehensive'
  portRange: text("port_range").notNull().default('1-1024'), // e.g., '1-1024', '80,443,8080', 'common'
  scanStatus: text("scan_status").notNull().default('pending'), // 'pending', 'scanning', 'completed', 'failed'
  openPortsCount: integer("open_ports_count").notNull().default(0),
  vulnerableServicesCount: integer("vulnerable_services_count").notNull().default(0),
  findingsCount: integer("findings_count").notNull().default(0),
  criticalCount: integer("critical_count").notNull().default(0),
  highCount: integer("high_count").notNull().default(0),
  mediumCount: integer("medium_count").notNull().default(0),
  lowCount: integer("low_count").notNull().default(0),
  // DNS Validation
  dnsRecordsChecked: boolean("dns_records_checked").notNull().default(false),
  dnsMisconfigCount: integer("dns_misconfig_count").notNull().default(0),
  // Fix workflow tracking
  fixesApplied: boolean("fixes_applied").default(false),
  lastValidationStatus: text("last_validation_status"), // 'pass', 'fail', 'pending', null
  scannedAt: timestamp("scanned_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertNetworkScanSchema = createInsertSchema(networkScans).omit({
  id: true,
  createdAt: true,
}).extend({
  scannedAt: z.coerce.date().optional(),
});

export type InsertNetworkScan = z.infer<typeof insertNetworkScanSchema>;
export type NetworkScan = typeof networkScans.$inferSelect;

export const linterScans = pgTable("linter_scans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  repositoryUrl: text("repository_url").notNull(),
  projectName: text("project_name").notNull(),
  language: text("language").notNull(), // 'javascript', 'typescript', 'python', 'java', 'go', 'mixed'
  scanStatus: text("scan_status").notNull().default('pending'), // 'pending', 'scanning', 'completed', 'failed'
  issuesCount: integer("issues_count").notNull().default(0),
  hygieneIssuesCount: integer("hygiene_issues_count").notNull().default(0),
  bestPracticeIssuesCount: integer("best_practice_issues_count").notNull().default(0),
  securityIssuesCount: integer("security_issues_count").notNull().default(0),
  // Fix workflow tracking
  fixesApplied: boolean("fixes_applied").default(false),
  uploadPreference: text("upload_preference"), // 'fix-and-upload', 'upload-without-fixes', null
  autoUploadDestination: text("auto_upload_destination"), // Repository URL where fixes are uploaded
  lastValidationStatus: text("last_validation_status"), // 'pass', 'fail', 'pending', null
  lastUploadStatus: text("last_upload_status"), // 'success', 'failed', 'pending', null
  codeContent: text("code_content"),
  scannedAt: timestamp("scanned_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertLinterScanSchema = createInsertSchema(linterScans).omit({
  id: true,
  createdAt: true,
}).extend({
  scannedAt: z.coerce.date().optional(),
});

export type InsertLinterScan = z.infer<typeof insertLinterScanSchema>;
export type LinterScan = typeof linterScans.$inferSelect;

// Linter Fix Batches Table - tracks batch fix operations for linter scans
export const linterFixBatches = pgTable("linter_fix_batches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  linterScanId: varchar("linter_scan_id").notNull().references(() => linterScans.id, { onDelete: "cascade" }),
  // Fix scope
  mode: text("mode").notNull(), // 'single' (one finding) or 'all' (all findings)
  findingId: varchar("finding_id"), // If mode='single', which finding was fixed
  // Batch status
  status: text("status").notNull().default('pending'), // 'pending', 'applying', 'validating', 'completed', 'failed'
  progress: integer("progress").notNull().default(0), // 0-100
  // Fix results
  findingsToFix: integer("findings_to_fix").notNull().default(0), // Total findings to fix
  findingsFixed: integer("findings_fixed").notNull().default(0), // Successfully fixed
  findingsFailed: integer("findings_failed").notNull().default(0), // Failed to fix
  // Validation
  validationStatus: text("validation_status"), // 'pass', 'fail', 'pending'
  validationIssues: jsonb("validation_issues"), // Issues found during validation
  // Upload tracking
  uploadStatus: text("upload_status"), // 'success', 'failed', 'pending'
  uploadDestination: text("upload_destination"), // Repository URL
  uploadedAt: timestamp("uploaded_at"),
  // Payment (for automated fix-all)
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  paymentStatus: text("payment_status").default('unpaid'), // 'unpaid', 'pending', 'paid', 'failed'
  paymentAmount: integer("payment_amount"), // Amount in cents
  // AI outputs
  manualFixSnippets: jsonb("manual_fix_snippets"), // Free manual fix code snippets
  automatedFixDetails: jsonb("automated_fix_details"), // Paid automated fix results
  // Error tracking
  errorMessage: text("error_message"),
  errorDetails: jsonb("error_details"),
  // Timestamps
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertLinterFixBatchSchema = createInsertSchema(linterFixBatches).omit({
  id: true,
  createdAt: true,
});

export type InsertLinterFixBatch = z.infer<typeof insertLinterFixBatchSchema>;
export type LinterFixBatch = typeof linterFixBatches.$inferSelect;

// Pipeline Fix Batches Table - tracks batch fix operations for pipeline scans
export const pipelineFixBatches = pgTable("pipeline_fix_batches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  pipelineScanId: varchar("pipeline_scan_id").notNull().references(() => pipelineScans.id, { onDelete: "cascade" }),
  // Fix scope
  mode: text("mode").notNull(), // 'single' (one finding) or 'all' (all findings)
  findingId: varchar("finding_id"), // If mode='single', which finding was fixed
  // Batch status
  status: text("status").notNull().default('pending'), // 'pending', 'applying', 'validating', 'completed', 'failed'
  progress: integer("progress").notNull().default(0), // 0-100
  // Fix results
  findingsToFix: integer("findings_to_fix").notNull().default(0), // Total findings to fix
  findingsFixed: integer("findings_fixed").notNull().default(0), // Successfully fixed
  findingsFailed: integer("findings_failed").notNull().default(0), // Failed to fix
  // Validation
  validationStatus: text("validation_status"), // 'pass', 'fail', 'pending'
  validationIssues: jsonb("validation_issues"), // Issues found during validation
  // Upload tracking
  uploadStatus: text("upload_status"), // 'success', 'failed', 'pending'
  uploadDestination: text("upload_destination"), // Repository URL
  uploadedAt: timestamp("uploaded_at"),
  // Payment (for automated fix-all)
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  paymentStatus: text("payment_status").default('unpaid'), // 'unpaid', 'pending', 'paid', 'failed'
  paymentAmount: integer("payment_amount"), // Amount in cents
  // AI outputs
  manualFixSnippets: jsonb("manual_fix_snippets"), // Free manual fix code snippets
  automatedFixDetails: jsonb("automated_fix_details"), // Paid automated fix results
  // Error tracking
  errorMessage: text("error_message"),
  errorDetails: jsonb("error_details"),
  // Timestamps
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertPipelineFixBatchSchema = createInsertSchema(pipelineFixBatches).omit({
  id: true,
  createdAt: true,
});

export type InsertPipelineFixBatch = z.infer<typeof insertPipelineFixBatchSchema>;
export type PipelineFixBatch = typeof pipelineFixBatches.$inferSelect;

// Network Fix Batches Table - tracks batch fix operations for network scans
export const networkFixBatches = pgTable("network_fix_batches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  networkScanId: varchar("network_scan_id").notNull().references(() => networkScans.id, { onDelete: "cascade" }),
  // Fix scope
  mode: text("mode").notNull(), // 'single' (one finding) or 'all' (all findings)
  findingId: varchar("finding_id"), // If mode='single', which finding was fixed
  // Batch status
  status: text("status").notNull().default('pending'), // 'pending', 'applying', 'validating', 'completed', 'failed'
  progress: integer("progress").notNull().default(0), // 0-100
  // Fix results
  findingsToFix: integer("findings_to_fix").notNull().default(0), // Total findings to fix
  findingsFixed: integer("findings_fixed").notNull().default(0), // Successfully fixed
  findingsFailed: integer("findings_failed").notNull().default(0), // Failed to fix
  // Validation
  validationStatus: text("validation_status"), // 'pass', 'fail', 'pending'
  validationIssues: jsonb("validation_issues"), // Issues found during validation
  // Payment (for automated fix-all)
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  paymentStatus: text("payment_status").default('unpaid'), // 'unpaid', 'pending', 'paid', 'failed'
  paymentAmount: integer("payment_amount"), // Amount in cents
  // AI outputs
  manualFixSnippets: jsonb("manual_fix_snippets"), // Free manual fix code snippets
  automatedFixDetails: jsonb("automated_fix_details"), // Paid automated fix results
  // Domain-specific metadata
  impactedServices: jsonb("impacted_services"), // Services affected by fixes
  // Error tracking
  errorMessage: text("error_message"),
  errorDetails: jsonb("error_details"),
  // Timestamps
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertNetworkFixBatchSchema = createInsertSchema(networkFixBatches).omit({
  id: true,
  createdAt: true,
});

export type InsertNetworkFixBatch = z.infer<typeof insertNetworkFixBatchSchema>;
export type NetworkFixBatch = typeof networkFixBatches.$inferSelect;

// Container Fix Batches Table - tracks batch fix operations for container scans
export const containerFixBatches = pgTable("container_fix_batches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  containerScanId: varchar("container_scan_id").notNull().references(() => containerScans.id, { onDelete: "cascade" }),
  // Fix scope
  mode: text("mode").notNull(), // 'single' (one finding) or 'all' (all findings)
  findingId: varchar("finding_id"), // If mode='single', which finding was fixed
  // Batch status
  status: text("status").notNull().default('pending'), // 'pending', 'applying', 'validating', 'completed', 'failed'
  progress: integer("progress").notNull().default(0), // 0-100
  // Fix results
  findingsToFix: integer("findings_to_fix").notNull().default(0), // Total findings to fix
  findingsFixed: integer("findings_fixed").notNull().default(0), // Successfully fixed
  findingsFailed: integer("findings_failed").notNull().default(0), // Failed to fix
  // Validation
  validationStatus: text("validation_status"), // 'pass', 'fail', 'pending'
  validationIssues: jsonb("validation_issues"), // Issues found during validation
  // Payment (for automated fix-all)
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  paymentStatus: text("payment_status").default('unpaid'), // 'unpaid', 'pending', 'paid', 'failed'
  paymentAmount: integer("payment_amount"), // Amount in cents
  // AI outputs
  manualFixSnippets: jsonb("manual_fix_snippets"), // Free manual fix code snippets
  automatedFixDetails: jsonb("automated_fix_details"), // Paid automated fix results
  // Domain-specific metadata
  imageDigest: text("image_digest"), // Container image digest for tracking
  // Error tracking
  errorMessage: text("error_message"),
  errorDetails: jsonb("error_details"),
  // Timestamps
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertContainerFixBatchSchema = createInsertSchema(containerFixBatches).omit({
  id: true,
  createdAt: true,
});

export type InsertContainerFixBatch = z.infer<typeof insertContainerFixBatchSchema>;
export type ContainerFixBatch = typeof containerFixBatches.$inferSelect;

// Scheduled Scans Table
export const scheduledScans = pgTable("scheduled_scans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  scanType: text("scan_type").notNull(), // 'mvp', 'mobile', 'web', 'pipeline', 'container', 'network', 'linter'
  scanConfig: text("scan_config").notNull(), // JSON string with scan configuration
  frequency: text("frequency").notNull(), // 'daily', 'weekly', 'monthly', 'custom'
  cronExpression: text("cron_expression"), // Custom cron expression if frequency is 'custom'
  isActive: boolean("is_active").notNull().default(true),
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertScheduledScanSchema = createInsertSchema(scheduledScans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastRunAt: true,
  nextRunAt: true,
});

export type InsertScheduledScan = z.infer<typeof insertScheduledScanSchema>;
export type ScheduledScan = typeof scheduledScans.$inferSelect;

// Alert Settings Table
export const alertSettings = pgTable("alert_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  // Channel-specific settings
  slackEnabled: boolean("slack_enabled").notNull().default(false),
  slackWebhookUrl: text("slack_webhook_url"),
  teamsEnabled: boolean("teams_enabled").notNull().default(false),
  teamsWebhookUrl: text("teams_webhook_url"),
  emailEnabled: boolean("email_enabled").notNull().default(false),
  emailRecipients: text("email_recipients").array(),
  smsEnabled: boolean("sms_enabled").notNull().default(false),
  smsPhoneNumbers: text("sms_phone_numbers").array(),
  // Severity thresholds
  alertOnCritical: boolean("alert_on_critical").notNull().default(true),
  alertOnHigh: boolean("alert_on_high").notNull().default(true),
  alertOnMedium: boolean("alert_on_medium").notNull().default(false),
  alertOnLow: boolean("alert_on_low").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertAlertSettingsSchema = createInsertSchema(alertSettings).omit({
  id: true,
  updatedAt: true,
});

export type InsertAlertSettings = z.infer<typeof insertAlertSettingsSchema>;
export type AlertSettings = typeof alertSettings.$inferSelect;

// SSO Providers Table
export const ssoProviders = pgTable("sso_providers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // Display name (e.g., "Okta", "Azure AD")
  type: text("type").notNull(), // 'saml' or 'oidc'
  enabled: boolean("enabled").notNull().default(true),
  
  // SAML Configuration
  samlEntryPoint: text("saml_entry_point"), // IdP SSO URL
  samlIssuer: text("saml_issuer"), // IdP Entity ID
  samlCert: text("saml_cert"), // IdP Certificate (PEM format)
  samlCallbackUrl: text("saml_callback_url"), // SP ACS URL
  samlEntityId: text("saml_entity_id"), // SP Entity ID
  
  // OAuth/OIDC Configuration
  oidcIssuer: text("oidc_issuer"), // OIDC Issuer URL
  oidcClientId: text("oidc_client_id"), // OAuth Client ID
  oidcClientSecret: text("oidc_client_secret"), // OAuth Client Secret
  oidcCallbackUrl: text("oidc_callback_url"), // OAuth Redirect URI
  oidcScopes: text("oidc_scopes").array().default(sql`ARRAY['openid', 'profile', 'email']`),
  
  // Role Mapping (map IdP attributes to app roles)
  roleAttributeName: text("role_attribute_name"), // Attribute name containing roles
  adminRoleValues: text("admin_role_values").array(), // Values that map to admin role
  devRoleValues: text("dev_role_values").array(), // Values that map to developer role
  
  // Metadata
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertSsoProviderSchema = createInsertSchema(ssoProviders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSsoProvider = z.infer<typeof insertSsoProviderSchema>;
export type SsoProvider = typeof ssoProviders.$inferSelect;

export const termsOfServiceAcceptances = pgTable("terms_of_service_acceptances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(), // Each user can only have one acceptance record
  version: text("version").notNull().default("1.0"), // ToS version number
  accepted: boolean("accepted").notNull().default(false),
  acceptedAt: timestamp("accepted_at"),
  ipAddress: text("ip_address"), // Track IP for legal purposes
  userAgent: text("user_agent"), // Track browser/device info
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertTermsOfServiceAcceptanceSchema = createInsertSchema(termsOfServiceAcceptances).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTermsOfServiceAcceptance = z.infer<typeof insertTermsOfServiceAcceptanceSchema>;
export type TermsOfServiceAcceptance = typeof termsOfServiceAcceptances.$inferSelect;

// Scan Validations Table - Tracks comprehensive code validation runs
export const scanValidations = pgTable("scan_validations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  scanType: text("scan_type").notNull(), // 'mvp', 'mobile', 'web'
  scanId: varchar("scan_id").notNull(), // ID of the associated scan
  status: text("status").notNull().default('pending'), // 'pending', 'running', 'passed', 'failed', 'blocked'
  // Validation Results
  staticAnalysisResults: jsonb("static_analysis_results"), // ESLint, Prettier, type checking results
  dependencyAuditResults: jsonb("dependency_audit_results"), // npm audit, outdated dependencies
  testResults: jsonb("test_results"), // Unit tests, integration tests results
  aiAnalysisResults: jsonb("ai_analysis_results"), // LLM-based code review findings
  // Summary
  totalIssues: integer("total_issues").notNull().default(0),
  blockingIssues: integer("blocking_issues").notNull().default(0), // Issues that prevent upload
  warningIssues: integer("warning_issues").notNull().default(0),
  // AI Recommendations
  aiRecommendations: jsonb("ai_recommendations"), // Auto-fix suggestions
  autoFixAvailable: boolean("auto_fix_available").notNull().default(false),
  autoFixApplied: boolean("auto_fix_applied").notNull().default(false),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertScanValidationSchema = createInsertSchema(scanValidations).omit({
  id: true,
  createdAt: true,
});

export type InsertScanValidation = z.infer<typeof insertScanValidationSchema>;
export type ScanValidation = typeof scanValidations.$inferSelect;

// Fix Validation Sessions - Tracks multi-step fix validation workflow
export const fixValidationSessions = pgTable("fix_validation_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  scanType: text("scan_type").notNull(), // 'mvp', 'mobile', 'web'
  scanId: varchar("scan_id").notNull(),
  // Pre-fix validation (initial check before applying fixes)
  preFixValidationStatus: text("pre_fix_validation_status").notNull().default('pending'), // 'pending', 'running', 'passed', 'failed'
  preFixIssues: jsonb("pre_fix_issues"), // Issues found before applying fixes
  preFixWarnings: jsonb("pre_fix_warnings"), // Warnings about potential conflicts
  // Fix application
  fixesApplied: boolean("fixes_applied").notNull().default(false),
  fixesAppliedAt: timestamp("fixes_applied_at"),
  // Post-fix validation (comprehensive app scan after applying fixes)
  postFixValidationStatus: text("post_fix_validation_status").default('pending'), // 'pending', 'running', 'passed', 'failed'
  postFixIssues: jsonb("post_fix_issues"), // Issues found after applying fixes
  postFixTestResults: jsonb("post_fix_test_results"), // Comprehensive test results
  // AI-generated code snippets for manual fixes
  manualFixSnippets: jsonb("manual_fix_snippets"), // Array of { filePath, lineNumber, code, description }
  // Payment tracking for automated fix service
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  paymentStatus: text("payment_status").default('unpaid'), // 'unpaid', 'pending', 'paid', 'failed'
  automatedFixRequested: boolean("automated_fix_requested").notNull().default(false),
  automatedFixJobId: varchar("automated_fix_job_id"), // Reference to automated fix job
  // Workflow tracking
  currentStep: text("current_step").notNull().default('pre_validation'), // 'pre_validation', 'apply_fixes', 'post_validation', 'results', 'completed'
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertFixValidationSessionSchema = createInsertSchema(fixValidationSessions).omit({
  id: true,
  createdAt: true,
});

export type InsertFixValidationSession = z.infer<typeof insertFixValidationSessionSchema>;
export type FixValidationSession = typeof fixValidationSessions.$inferSelect;

// Notifications - Tracks notification history for users
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // 'scan_start', 'scan_complete', 'fixes_applied', 'upload_complete'
  title: text("title").notNull(),
  message: text("message").notNull(),
  scanId: varchar("scan_id"), // Reference to the scan that triggered this notification
  scanType: text("scan_type"), // 'mvp', 'mobile', 'web', 'pipeline', 'container', 'network', 'linter'
  read: boolean("read").notNull().default(false),
  url: text("url"), // Optional URL to navigate to when clicked
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (table) => ({
  userReadCreatedIdx: index("notifications_user_read_created_idx").on(table.userId, table.read, table.createdAt),
  scanIdx: index("notifications_scan_idx").on(table.scanId),
}));

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

// Automated Fix Jobs - Tracks paid automated fix service runs
export const automatedFixJobs = pgTable("automated_fix_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sessionId: varchar("session_id").notNull().references(() => fixValidationSessions.id, { onDelete: "cascade" }),
  scanType: text("scan_type").notNull(),
  scanId: varchar("scan_id").notNull(),
  // Job status
  status: text("status").notNull().default('queued'), // 'queued', 'running', 'completed', 'failed'
  progress: integer("progress").notNull().default(0), // 0-100
  currentTask: text("current_task"), // Description of what's currently being fixed
  // Fix results
  issuesFixed: integer("issues_fixed").notNull().default(0),
  issuesFailed: integer("issues_failed").notNull().default(0),
  fixDetails: jsonb("fix_details"), // Array of { issue, fix, status, error }
  // AI analysis
  aiFixSuggestions: jsonb("ai_fix_suggestions"),
  appliedFixes: jsonb("applied_fixes"), // Code changes made
  // Error tracking
  errorMessage: text("error_message"),
  errorDetails: jsonb("error_details"),
  // Post-fix testing (runs after fixes are applied to verify app still works)
  testStatus: text("test_status").notNull().default('not_tested'), // 'not_tested', 'running', 'passed', 'failed'
  testProgress: integer("test_progress").notNull().default(0), // 0-100
  testSummary: text("test_summary"), // Brief description of test results
  testDetails: jsonb("test_details"), // Detailed test results: { tests: [{name, status, error}], duration, timestamp }
  testStartedAt: timestamp("test_started_at"),
  testCompletedAt: timestamp("test_completed_at"),
  // Timing
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertAutomatedFixJobSchema = createInsertSchema(automatedFixJobs).omit({
  id: true,
  createdAt: true,
});

export type InsertAutomatedFixJob = z.infer<typeof insertAutomatedFixJobSchema>;
export type AutomatedFixJob = typeof automatedFixJobs.$inferSelect;

// Global Fix Jobs - Orchestrates fixes across multiple scans with unified payment
export const globalFixJobs = pgTable("global_fix_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // Overall job status
  status: text("status").notNull().default('pending'), // 'pending', 'payment_pending', 'processing', 'completed', 'partial_success', 'failed'
  // Pricing
  totalIssues: integer("total_issues").notNull().default(0),
  totalAmount: integer("total_amount").notNull().default(0), // In cents
  // Stripe payment
  stripePaymentIntentId: varchar("stripe_payment_intent_id"),
  paymentStatus: text("payment_status").notNull().default('pending'), // 'pending', 'paid', 'failed'
  demoMode: boolean("demo_mode").notNull().default(false),
  // Progress tracking
  totalScans: integer("total_scans").notNull().default(0),
  scansCompleted: integer("scans_completed").notNull().default(0),
  scansFailed: integer("scans_failed").notNull().default(0),
  // Timing
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  paymentConfirmedAt: timestamp("payment_confirmed_at"),
  completedAt: timestamp("completed_at"),
});

export const insertGlobalFixJobSchema = createInsertSchema(globalFixJobs).omit({
  id: true,
  createdAt: true,
});

export type InsertGlobalFixJob = z.infer<typeof insertGlobalFixJobSchema>;
export type GlobalFixJob = typeof globalFixJobs.$inferSelect;

// Global Fix Scan Tasks - Individual scan tasks within a global fix job
export const globalFixScanTasks = pgTable("global_fix_scan_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => globalFixJobs.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // Scan identification
  scanId: varchar("scan_id").notNull(),
  scanType: text("scan_type").notNull(), // 'mvp', 'mobile', 'web', 'pipeline', 'container', 'network', 'linter'
  scanName: text("scan_name").notNull(), // Display name
  // Task status
  status: text("status").notNull().default('pending'), // 'pending', 'applying_fixes', 'validating', 'completed', 'failed'
  progress: integer("progress").notNull().default(0), // 0-100
  // Fix results
  issueCount: integer("issue_count").notNull().default(0),
  issuesFixed: integer("issues_fixed").notNull().default(0),
  issuesFailed: integer("issues_failed").notNull().default(0),
  // Validation
  validationStatus: text("validation_status"), // 'pending', 'passed', 'failed', 'skipped'
  validationErrors: jsonb("validation_errors"), // Array of validation issues
  // Upload decision
  uploadDecision: text("upload_decision"), // 'pending', 'yes', 'no', 'with_tests'
  uploadStatus: text("upload_status"), // 'pending', 'uploading', 'completed', 'failed'
  // Test-first workflow tracking
  testStatus: text("test_status").notNull().default('none'), // 'none', 'running', 'passed', 'failed'
  testCompletedAt: timestamp("test_completed_at"),
  readyForUpload: boolean("ready_for_upload").notNull().default(false), // True when tests pass and upload not yet triggered
  // Error tracking
  errorMessage: text("error_message"),
  errorDetails: jsonb("error_details"),
  // Timing
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertGlobalFixScanTaskSchema = createInsertSchema(globalFixScanTasks).omit({
  id: true,
  createdAt: true,
});

export type InsertGlobalFixScanTask = z.infer<typeof insertGlobalFixScanTaskSchema>;
export type GlobalFixScanTask = typeof globalFixScanTasks.$inferSelect;
