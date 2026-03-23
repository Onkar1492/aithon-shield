import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertFindingSchema, 
  insertMobileAppScanSchema,
  updateMobileAppScanSchema,
  insertMvpCodeScanSchema,
  updateMvpCodeScanSchema,
  insertWebAppScanSchema,
  updateWebAppScanSchema,
  insertReportSchema,
  insertPipelineScanSchema,
  updatePipelineScanSchema,
  insertContainerScanSchema,
  insertNetworkScanSchema,
  insertLinterScanSchema,
  insertScheduledScanSchema,
  insertAlertSettingsSchema,
  insertSsoProviderSchema,
  insertTermsOfServiceAcceptanceSchema,
  signUpSchema,
  loginSchema,
  updateProfileSchema,
  updateNotificationsSchema,
  type User as SchemaUser,
  type FixValidationSession
} from "@shared/schema";
import { z, ZodError } from "zod";
import QRCode from "qrcode";
import PDFDocument from "pdfkit";
import { sendAlerts } from "./alertService";
import { fetchThreatIntelligence } from "./threatFeedService";
import passport from "passport";
import { randomBytes } from "crypto";
import { createSamlStrategy, generateSamlMetadata } from "./samlService";
import { getAuthorizationUrl, handleOidcCallback, clearOidcClientCache } from "./oidcService";
import { hashPassword, comparePassword, createSession, getSessionUserId, deleteSession, setupSessionCleanup } from "./auth";
import { sendPushNotification, getVapidPublicKey, notifyScanStart, notifyScanComplete, notifyFixesApplied, notifyUploadComplete } from "./pushNotificationService";
import { validateCodeBeforeUpload, runComprehensiveTests } from "./validation-service";
import Stripe from "stripe";

// Extend Express User type to match our schema
declare global {
  namespace Express {
    interface User extends SchemaUser {}
  }
}

// Type helper for authenticated requests
type AuthenticatedRequest = Express.Request & { user: SchemaUser };

export async function registerRoutes(app: Express): Promise<Server> {
  // put application routes here
  // prefix all routes with /api

  // use storage to perform CRUD operations on the storage interface
  // e.g. storage.insertUser(user) or storage.getUserByUsername(username)

  // Authentication middleware
  const requireAuth = async (req: any, res: any, next: any) => {
    const sessionId = req.cookies?.sessionId;
    
    if (!sessionId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const userId = await getSessionUserId(storage, sessionId);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    req.user = user;
    next();
  };

  // Helper function to mark findings as resolved when fixes are applied
  const applyFixesForScan = async (scanId: string, scanType: string, userId: string) => {
    console.log(`[applyFixesForScan] Starting for scanId: ${scanId}, scanType: ${scanType}, userId: ${userId}`);
    
    // First, get the findings before update to see what we're working with
    const findingsBefore = await storage.getAllFindings(userId, false);
    const scanFindingsBefore = findingsBefore.filter(f => f.scanId === scanId);
    console.log(`[applyFixesForScan] Found ${scanFindingsBefore.length} findings for scan ${scanId}`);
    console.log(`[applyFixesForScan] Findings before update:`, scanFindingsBefore.map(f => ({ id: f.id, status: f.status, fixesApplied: f.fixesApplied })));
    
    // Use the new markFindingsAsFixed helper to update findings
    await storage.markFindingsAsFixed(scanId, scanType, userId);
    
    // Verify the update happened
    const findingsAfter = await storage.getAllFindings(userId, false);
    const scanFindingsAfter = findingsAfter.filter(f => f.scanId === scanId);
    console.log(`[applyFixesForScan] Findings after update:`, scanFindingsAfter.map(f => ({ id: f.id, status: f.status, fixesApplied: f.fixesApplied })));
    
    // Recalculate priority scores to update security health metrics
    await storage.recalculatePriorityScores();
    console.log(`[applyFixesForScan] Completed for scanId: ${scanId}`);
  };

  // Global Fix Job Processor - Sequentially process fixes across all scans
  const processGlobalFixJob = async (jobId: string, userId: string) => {
    console.log(`[GlobalFixJob] Starting job ${jobId} for user ${userId}`);

    try {
      // Get all tasks for this job
      const tasks = await storage.getGlobalFixScanTasks(jobId, userId);
      console.log(`[GlobalFixJob] Found ${tasks.length} scan tasks to process`);

      let successCount = 0;
      let failureCount = 0;

      // Process each scan task sequentially
      for (const task of tasks) {
        console.log(`[GlobalFixJob] Processing task ${task.id} for scan ${task.scanId} (${task.scanType})`);

        try {
          // Update task status to applying_fixes
          await storage.updateGlobalFixScanTask(task.id, userId, {
            status: 'applying_fixes',
            progress: 10,
            startedAt: new Date(),
          });

          // Simulate applying fixes (in production, this would call actual fix service)
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Apply fixes to scan findings
          await applyFixesForScan(task.scanId, task.scanType, userId);

          await storage.updateGlobalFixScanTask(task.id, userId, {
            progress: 50,
          });

          // Mark the scan as having fixes applied for all scan types
          if (task.scanType === 'mvp') {
            await storage.updateMvpCodeScan(task.scanId, userId, { fixesApplied: true });
          } else if (task.scanType === 'mobile') {
            await storage.updateMobileAppScan(task.scanId, userId, { fixesApplied: true });
          } else if (task.scanType === 'web') {
            await storage.updateWebAppScan(task.scanId, userId, { fixesApplied: true });
          } else if (task.scanType === 'pipeline') {
            await storage.updatePipelineScan(task.scanId, userId, { fixesApplied: true });
          } else if (task.scanType === 'container') {
            await storage.updateContainerScan(task.scanId, userId, { fixesApplied: true });
          } else if (task.scanType === 'network') {
            await storage.updateNetworkScan(task.scanId, userId, { fixesApplied: true });
          } else if (task.scanType === 'linter') {
            await storage.updateLinterScan(task.scanId, userId, { fixesApplied: true });
          }

          // Update task status to validating
          await storage.updateGlobalFixScanTask(task.id, userId, {
            status: 'validating',
            progress: 70,
          });

          // Simulate validation (in production, use validation service)
          await new Promise(resolve => setTimeout(resolve, 1500));

          // Update task as completed
          await storage.updateGlobalFixScanTask(task.id, userId, {
            status: 'completed',
            progress: 100,
            issuesFixed: task.issueCount,
            issuesFailed: 0,
            validationStatus: 'passed',
            completedAt: new Date(),
          });

          successCount++;

          // Send notification for this scan completion
          await notifyFixesApplied(storage, userId, task.scanId, task.scanType, task.issueCount);

          console.log(`[GlobalFixJob] Task ${task.id} completed successfully`);

        } catch (error: any) {
          console.error(`[GlobalFixJob] Task ${task.id} failed:`, error);

          // Update task as failed
          await storage.updateGlobalFixScanTask(task.id, userId, {
            status: 'failed',
            errorMessage: error.message,
            errorDetails: { error: error.toString() },
            completedAt: new Date(),
          });

          failureCount++;
        }
      }

      // Update overall job status
      const finalStatus = failureCount === 0 ? 'completed' : 
                          successCount > 0 ? 'partial_success' : 
                          'failed';

      await storage.updateGlobalFixJob(jobId, userId, {
        status: finalStatus,
        scansCompleted: successCount,
        scansFailed: failureCount,
        completedAt: new Date(),
      });

      console.log(`[GlobalFixJob] Job ${jobId} finished: ${successCount} succeeded, ${failureCount} failed`);

      // Send summary notification
      await storage.createNotification({
        userId,
        type: 'fixes_applied',
        title: 'Global Fix Job Complete',
        message: `Fixed ${successCount} of ${tasks.length} scans. ${failureCount > 0 ? `${failureCount} failed.` : 'All scans successful!'}`,
        read: false,
      });

    } catch (error: any) {
      console.error(`[GlobalFixJob] Job ${jobId} fatal error:`, error);
      
      await storage.updateGlobalFixJob(jobId, userId, {
        status: 'failed',
        completedAt: new Date(),
      });
    }
  };

  // Helper function to detect programming language from file extension
  const detectLanguage = (filePath: string): string => {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'py': 'python',
      'java': 'java',
      'kt': 'kotlin',
      'swift': 'swift',
      'go': 'go',
      'rs': 'rust',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'rb': 'ruby',
      'php': 'php',
      'xml': 'xml',
      'html': 'html',
      'css': 'css',
      'sql': 'sql',
    };
    return languageMap[ext || ''] || 'plaintext';
  };

  // Helper function to generate fix code snippet (would use AI in production)
  const generateFixSnippet = (issue: any): string => {
    // Template-based code generation for common issues
    const { type, file, line, function: funcName } = issue;
    
    const language = detectLanguage(file);
    
    // TypeScript/JavaScript fixes
    if (language === 'typescript' || language === 'javascript') {
      if (type === 'runtime_error') {
        return `// Add null check before using the value
if (user && user.credentials) {
  const isValid = validateUserCredentials(user.credentials);
  // ... rest of your code
}`;
      }
      if (type === 'broken_functionality') {
        return `// Update validation to use new library
import { sanitize } from '@security/sanitize';

const sanitizedInput = sanitize(formData.input);
if (!sanitizedInput) {
  throw new Error('Invalid input');
}`;
      }
      if (type === 'performance') {
        return `// Cache the database query result
const cachedUser = await userCache.get(email);
if (cachedUser) return cachedUser;

const user = await db.findByEmail(email);
await userCache.set(email, user);
return user;`;
      }
    }
    
    // Generic fix template
    return `// TODO: Fix ${type} at ${file}:${line}
// Function: ${funcName}
// ${issue.description}`;
  };

  // Fix Workflow Factory - Generic implementation for network/container scan types
  // TODO: Refactor linter/pipeline to use this factory pattern in future
  
  interface FixWorkflowAdapter<TScan, TBatch> {
    scanType: 'network' | 'container';
    routePrefix: string;
    scanIdField: string;
    getScan: (id: string, userId: string) => Promise<TScan | undefined>;
    updateScan: (id: string, userId: string, updates: Partial<TScan>) => Promise<TScan | undefined>;
    getBatchByScan: (scanId: string, userId: string) => Promise<TBatch[]>;
    createBatch: (batch: any) => Promise<TBatch>;
    getBatch: (id: string, userId: string) => Promise<TBatch | undefined>;
    updateBatch: (id: string, userId: string, updates: Partial<TBatch>) => Promise<TBatch | undefined>;
  }

  // Shared helper to create or reuse Stripe payment intent
  const createOrReusePaymentIntent = async (
    batch: any,
    amount: number,
    userId: string,
    scanId: string
  ): Promise<{ paymentIntentId: string | null; clientSecret: string | null; demoMode: boolean }> => {
    const stripeSecretKey = process.env.TESTING_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
    const demoMode = !stripeSecretKey;

    if (demoMode) {
      console.warn(`[Fix Workflow] DEMO MODE: Skipping Stripe payment for batch ${batch.id}`);
      return { paymentIntentId: null, clientSecret: null, demoMode: true };
    }

    try {
      const stripe = new Stripe(stripeSecretKey, {
        apiVersion: "2023-10-16",
      });

      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: 'usd',
        metadata: {
          userId,
          scanId,
          fixBatchId: batch.id,
          issueCount: batch.findingsToFix?.toString() || '0',
        },
      });

      return {
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        demoMode: false
      };
    } catch (stripeError) {
      console.error('[Fix Workflow] Stripe error:', stripeError);
      throw new Error('Payment service error');
    }
  };

  // Shared helper to start simulated fix workflow
  const startSimulatedFixWorkflow = async <TBatch>(
    adapter: FixWorkflowAdapter<any, TBatch>,
    batch: any,
    userId: string
  ): Promise<void> => {
    const scanIdValue = (batch as any)[adapter.scanIdField];
    
    setTimeout(async () => {
      try {
        await adapter.updateBatch((batch as any).id, userId, {
          status: 'validating',
          progress: 50,
          findingsFixed: batch.findingsToFix,
        } as unknown as Partial<TBatch>);

        setTimeout(async () => {
          try {
            await adapter.updateBatch((batch as any).id, userId, {
              status: 'completed',
              progress: 100,
              validationStatus: 'pass',
              uploadStatus: 'pending',
            } as unknown as Partial<TBatch>);

            await adapter.updateScan(scanIdValue, userId, {
              fixesApplied: true,
              lastValidationStatus: 'pass',
            } as any);

            await applyFixesForScan(scanIdValue, adapter.scanType, userId);
          } catch (error) {
            console.error(`[${adapter.scanType} Auto-Fix] Validation failed:`, error);
            await adapter.updateBatch((batch as any).id, userId, {
              status: 'failed',
              errorMessage: 'Validation failed',
            } as unknown as Partial<TBatch>);
          }
        }, 2000);
      } catch (error) {
        console.error(`[${adapter.scanType} Auto-Fix] Fix application failed:`, error);
        await adapter.updateBatch((batch as any).id, userId, {
          status: 'failed',
          errorMessage: 'Fix application failed',
        } as unknown as Partial<TBatch>);
      }
    }, 3000);
  };

  // Factory function to register fix workflow routes
  const registerFixWorkflowRoutes = <TScan, TBatch>(
    app: Express,
    requireAuth: any,
    adapter: FixWorkflowAdapter<TScan, TBatch>
  ) => {
    // POST /api/{scanType}-scans/:id/auto-fix-all
    app.post(`/api/${adapter.routePrefix}-scans/:id/auto-fix-all`, requireAuth, async (req: any, res) => {
      try {
        const scan = await adapter.getScan(req.params.id, req.user.id);
        
        if (!scan) {
          return res.status(404).json({ message: `${adapter.scanType} scan not found` });
        }

        const findings = await storage.getAllFindings(req.user.id, false);
        const scanFindings = findings.filter((f: any) => f.scanId === req.params.id && f.status !== 'resolved');
        const issueCount = scanFindings.length;

        if (issueCount === 0) {
          return res.status(400).json({ message: "No issues to fix" });
        }

        const BASE_FEE = 500;
        const PER_ISSUE_FEE = 200;
        const totalAmount = BASE_FEE + (PER_ISSUE_FEE * issueCount);

        const batchData = {
          userId: req.user.id,
          [adapter.scanIdField]: req.params.id,
          findingsToFix: issueCount,
          status: 'pending',
          paymentAmount: totalAmount,
          paymentStatus: 'pending',
          progress: 0,
        };

        const batch = await adapter.createBatch(batchData);

        const { paymentIntentId, clientSecret, demoMode } = await createOrReusePaymentIntent(
          batch,
          totalAmount,
          req.user.id,
          req.params.id
        );

        await adapter.updateBatch((batch as any).id, req.user.id, {
          stripePaymentIntentId: paymentIntentId,
        } as unknown as Partial<TBatch>);

        res.json({
          batchId: (batch as any).id,
          clientSecret,
          amount: totalAmount,
          issueCount,
          demoMode,
        });
      } catch (error: any) {
        res.status(500).json({ message: error.message });
      }
    });

    // POST /api/{scanType}-fix-batches/:id/confirm-payment
    app.post(`/api/${adapter.routePrefix}-fix-batches/:id/confirm-payment`, requireAuth, async (req: any, res) => {
      try {
        const batch = await adapter.getBatch(req.params.id, req.user.id);
        
        if (!batch) {
          return res.status(404).json({ message: "Fix batch not found" });
        }

        if ((batch as any).status !== 'pending') {
          return res.status(400).json({ message: "Batch is not awaiting payment" });
        }

        const { demoMode } = req.body;
        const batchPaymentId = (batch as any).stripePaymentIntentId;

        if (!batchPaymentId) {
          if (!demoMode && (process.env.TESTING_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY)) {
            return res.status(400).json({ 
              message: "Payment required. This batch requires a valid payment intent.",
              hint: "Use the /auto-fix-all endpoint to create a payment intent first"
            });
          }
          console.warn(`[${adapter.scanType} Confirm Payment] DEMO MODE: Proceeding without payment verification`);
        } else if (!(process.env.TESTING_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY)) {
          return res.status(503).json({ 
            message: "Payment service unavailable. Stripe is not configured.",
            hint: "Contact support to configure Stripe keys"
          });
        } else {
          try {
      
            const stripe = new Stripe((process.env.TESTING_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY), {
              apiVersion: "2023-10-16",
            });
            
            const paymentIntent = await stripe.paymentIntents.retrieve(batchPaymentId);
            
            if (paymentIntent.status !== 'succeeded') {
              return res.status(400).json({ 
                message: "Payment not completed. Please complete payment before proceeding.",
                paymentStatus: paymentIntent.status 
              });
            }

            if ((batch as any).paymentAmount && paymentIntent.amount !== (batch as any).paymentAmount) {
              return res.status(400).json({ 
                message: "Payment amount mismatch",
                expected: (batch as any).paymentAmount,
                received: paymentIntent.amount
              });
            }
          } catch (stripeError) {
            console.error(`[${adapter.scanType} Confirm Payment] Stripe verification failed:`, stripeError);
            return res.status(500).json({ message: "Payment verification failed" });
          }
        }

        await adapter.updateBatch((batch as any).id, req.user.id, {
          status: 'applying',
          paymentStatus: 'paid',
          progress: 10,
        } as unknown as Partial<TBatch>);

        await startSimulatedFixWorkflow(adapter, batch, req.user.id);

        res.json({ message: "Payment confirmed, fix job started", batchId: (batch as any).id });
      } catch (error: any) {
        res.status(500).json({ message: error.message });
      }
    });
  };

  // Authentication endpoints
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const validatedData = signUpSchema.parse(req.body);
      
      // Check if user already exists
      const existingEmail = await storage.getUserByEmail(validatedData.email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email already exists" });
      }
      
      const existingUsername = await storage.getUserByUsername(validatedData.username);
      if (existingUsername) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      // Hash password
      const hashedPassword = await hashPassword(validatedData.password);
      
      // Create user
      const user = await storage.createUser({
        email: validatedData.email,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        username: validatedData.username,
        password: hashedPassword,
      });
      
      // Create session
      const sessionId = await createSession(storage, user.id);
      
      // Set session cookie
      res.cookie('sessionId', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });
      
      // TODO: Send welcome email when email service is configured
      // For now, we'll just log it
      console.log(`[Welcome Email] New user signed up: ${user.email} (${user.firstName} ${user.lastName})`);
      
      // Return user without password
      const { password: _, ...userWithoutPassword } = user;
      res.status(201).json({ user: userWithoutPassword });
    } catch (error: any) {
      if (error instanceof ZodError) {
        res.status(400).json({ message: error.errors[0].message });
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const validatedData = loginSchema.parse(req.body);
      
      // Find user by email or username
      const user = await storage.getUserByEmailOrUsername(validatedData.emailOrUsername);
      
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      // Verify password
      const isValidPassword = await comparePassword(validatedData.password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      // Create session
      const sessionId = await createSession(storage, user.id);
      
      // Set session cookie
      res.cookie('sessionId', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });
      
      // Return user without password
      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error: any) {
      if (error instanceof ZodError) {
        res.status(400).json({ message: error.errors[0].message });
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    const sessionId = req.cookies?.sessionId;
    if (sessionId) {
      await deleteSession(storage, sessionId);
      res.clearCookie('sessionId');
    }
    res.json({ message: "Logged out successfully" });
  });

  app.get("/api/auth/me", requireAuth, async (req: any, res) => {
    const { password: _, ...userWithoutPassword } = req.user;
    res.json({ user: userWithoutPassword });
  });

  app.patch("/api/user/profile", requireAuth, async (req: any, res) => {
    try {
      const validatedData = updateProfileSchema.parse(req.body);
      
      // If email is being updated, check if it already exists
      if (validatedData.email && validatedData.email !== req.user.email) {
        const existingEmail = await storage.getUserByEmail(validatedData.email);
        if (existingEmail) {
          return res.status(400).json({ message: "Email already exists" });
        }
      }
      
      // If password is being updated, hash it
      let updates: any = { ...validatedData };
      if (validatedData.password) {
        updates.password = await hashPassword(validatedData.password);
      }
      
      const user = await storage.updateUser(req.user.id, updates);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error: any) {
      if (error instanceof ZodError) {
        res.status(400).json({ message: error.errors[0].message });
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  app.patch("/api/user/notifications", requireAuth, async (req: any, res) => {
    try {
      const validatedData = updateNotificationsSchema.parse(req.body);
      
      const user = await storage.updateUser(req.user.id, validatedData);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error: any) {
      if (error instanceof ZodError) {
        res.status(400).json({ message: error.errors[0].message });
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  // Push Notification endpoints
  app.get("/api/push/vapid-public-key", async (_req, res) => {
    try {
      const publicKey = getVapidPublicKey();
      res.json({ publicKey });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/push/subscribe", requireAuth, async (req: any, res) => {
    try {
      const { subscription } = req.body;
      
      if (!subscription) {
        return res.status(400).json({ message: "Subscription object is required" });
      }
      
      // Store subscription as JSON string
      const user = await storage.updateUser(req.user.id, {
        pushSubscription: JSON.stringify(subscription)
      });
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({ success: true, message: "Push subscription saved" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/push/unsubscribe", requireAuth, async (req: any, res) => {
    try {
      const user = await storage.updateUser(req.user.id, {
        pushSubscription: null
      });
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({ success: true, message: "Push subscription removed" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Findings endpoints
  app.get("/api/findings", requireAuth, async (req: any, res) => {
    try {
      const { scanId, scanType } = req.query;
      
      let findings;
      // If scanId and scanType provided, filter by scan
      if (scanId && scanType) {
        // Validate scanType to prevent malformed requests
        const validScanTypes = ['mvp', 'mobile', 'web', 'pipeline', 'container', 'network', 'linter'];
        if (!validScanTypes.includes(scanType as string)) {
          return res.status(400).json({ message: 'Invalid scan type' });
        }
        findings = await storage.getFindingsByScan(scanId as string, req.user.id, scanType as string);
      } else {
        findings = await storage.getAllFindings(req.user.id, false);
      }
      
      // Sort by scan creation date (descending) - most recent scans first
      const sortedFindings = findings.sort((a: any, b: any) => {
        const dateA = a.scanCreatedAt ? new Date(a.scanCreatedAt).getTime() : 0;
        const dateB = b.scanCreatedAt ? new Date(b.scanCreatedAt).getTime() : 0;
        return dateB - dateA;
      });
      res.json(sortedFindings);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/findings/archived", requireAuth, async (req: any, res) => {
    try {
      const archivedFindings = await storage.getArchivedFindings(req.user.id);
      res.json(archivedFindings);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/findings", requireAuth, async (req: any, res) => {
    try {
      const validatedData = insertFindingSchema.omit({ userId: true }).parse(req.body);
      const finding = await storage.createFinding({
        ...validatedData,
        userId: req.user.id,
      });
      res.status(201).json(finding);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/findings/:id", requireAuth, async (req: any, res) => {
    try {
      const finding = await storage.updateFinding(req.params.id, req.user.id, req.body);
      if (!finding) {
        return res.status(404).json({ message: "Finding not found" });
      }
      res.json(finding);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/findings/:id/archive", requireAuth, async (req: any, res) => {
    try {
      const finding = await storage.archiveFinding(req.params.id, req.user.id);
      if (!finding) {
        return res.status(404).json({ message: "Finding not found" });
      }
      res.json(finding);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/findings/:id/restore", requireAuth, async (req: any, res) => {
    try {
      const finding = await storage.restoreFinding(req.params.id, req.user.id);
      if (!finding) {
        return res.status(404).json({ message: "Finding not found" });
      }
      res.json(finding);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/findings/:id/rescan", requireAuth, async (req: any, res) => {
    try {
      const finding = await storage.getFinding(req.params.id, req.user.id);
      if (!finding) {
        return res.status(404).json({ message: "Finding not found" });
      }

      // In a real app, this would trigger an async re-scan job
      // For now, we'll just acknowledge the request
      res.json({ message: "Re-scan initiated", findingId: req.params.id });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Validate a security fix before applying it
  app.post("/api/findings/:id/validate-fix", requireAuth, async (req: any, res) => {
    try {
      const finding = await storage.getFinding(req.params.id, req.user.id);
      if (!finding) {
        return res.status(404).json({ message: "Finding not found" });
      }

      if (finding.userId !== req.user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Simulate validation logic
      // In a real implementation, this would:
      // 1. Parse the codebase
      // 2. Identify dependencies and usage of the vulnerable code
      // 3. Check if the fix would break other parts
      // 4. Return file locations for manual application if conflicts exist
      
      const shouldFail = Math.random() < 0.3; // 30% chance of validation issues for demo
      
      if (shouldFail) {
        res.json({
          isValid: false,
          issues: [
            "Function signature change may break calls in 'src/controllers/AuthController.ts:145'",
            "Variable rename affects usage in 'src/services/UserService.ts:89-92'",
            "Import path modification impacts 'src/routes/api.ts:23'"
          ],
          fileLocations: [
            {
              file: "src/controllers/AuthController.ts",
              line: 145,
              function: "handleLogin",
              description: "Update function call to match new signature"
            },
            {
              file: "src/services/UserService.ts",
              line: 89,
              function: "validateUser",
              description: "Update variable references (lines 89-92)"
            },
            {
              file: "src/routes/api.ts",
              line: 23,
              function: null,
              description: "Update import statement"
            }
          ]
        });
      } else {
        res.json({
          isValid: true,
          issues: [],
          fileLocations: []
        });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/findings/:id/apply-fix", requireAuth, async (req: any, res) => {
    try {
      const finding = await storage.getFinding(req.params.id, req.user.id);
      if (!finding) {
        return res.status(404).json({ message: "Finding not found" });
      }

      if (finding.userId !== req.user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Update finding status to fixed
      await storage.updateFinding(req.params.id, req.user.id, {
        status: "fixed"
      });

      // Send push notification for fix applied
      await notifyFixesApplied(
        storage,
        finding.userId,
        finding.scanId,
        finding.scanType,
        1
      );

      res.json({ message: "Fix applied successfully", findingId: req.params.id });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Cleanup old archived findings (call this periodically)
  app.post("/api/findings/cleanup", async (_req, res) => {
    try {
      await storage.cleanupOldArchivedFindings();
      res.json({ message: "Cleanup completed" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Recalculate priority scores for all findings
  app.post("/api/findings/recalculate-priorities", async (_req, res) => {
    try {
      await storage.recalculatePriorityScores();
      res.json({ message: "Priority scores recalculated for all findings" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Mobile App Scan endpoints
  app.get("/api/mobile-scans", requireAuth, async (req: any, res) => {
    try {
      const scans = await storage.getAllMobileAppScans(req.user.id);
      res.json(scans);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/mobile-scans/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      const scan = await storage.getMobileAppScan(req.params.id, userId);
      if (!scan || scan.userId !== userId) {
        return res.status(404).json({ message: "Scan not found" });
      }
      
      // Calculate real-time finding counts
      const counts = await storage.getFindingCountsByScan(req.params.id, userId);
      
      // Always update scan record to keep it in sync
      if (scan.findingsCount !== counts.findingsCount || 
          scan.criticalCount !== counts.criticalCount || 
          scan.highCount !== counts.highCount ||
          scan.mediumCount !== counts.mediumCount ||
          scan.lowCount !== counts.lowCount) {
        await storage.updateMobileAppScan(req.params.id, userId, counts);
      }
      
      // Return enriched scan data
      res.json({
        ...scan,
        ...counts,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/mobile-scans/:id/findings", requireAuth, async (req: any, res) => {
    try {
      const scan = await storage.getMobileAppScan(req.params.id, req.user.id);
      if (!scan || scan.userId !== req.user.id) {
        return res.status(404).json({ message: "Scan not found" });
      }
      const findings = await storage.getFindingsByScan(req.params.id, req.user.id, "mobile");
      res.json(findings);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/mobile-scans", requireAuth, async (req, res) => {
    try {
      const validatedData = insertMobileAppScanSchema.omit({ userId: true }).parse(req.body);
      const scan = await storage.createMobileAppScan({
        ...validatedData,
        userId: req.user.id,
      });
      res.status(201).json(scan);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/mobile-scans/:id", requireAuth, async (req: any, res) => {
    try {
      const scan = await storage.getMobileAppScan(req.params.id, req.user.id);
      if (!scan || scan.userId !== req.user.id) {
        return res.status(404).json({ message: "Scan not found" });
      }

      // Only allow editing specific fields (not platform to avoid invalidating results)
      const validatedData = updateMobileAppScanSchema.parse(req.body);
      
      // Reject empty PATCH bodies (true PATCH semantics)
      if (Object.keys(validatedData).length === 0) {
        return res.status(400).json({ message: "No fields to update" });
      }

      const updatedScan = await storage.updateMobileAppScan(req.params.id, req.user.id, validatedData);
      res.json(updatedScan);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/mobile-scans/:id", requireAuth, async (req: any, res) => {
    try {
      const scan = await storage.getMobileAppScan(req.params.id, req.user.id);
      if (!scan || scan.userId !== req.user.id) {
        return res.status(404).json({ message: "Scan not found" });
      }

      await storage.deleteMobileAppScan(req.params.id, req.user.id);
      res.json({ success: true, message: "Scan deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/mobile-scans/:id/cancel", requireAuth, async (req: any, res) => {
    try {
      const scan = await storage.getMobileAppScan(req.params.id, req.user.id);
      if (!scan || scan.userId !== req.user.id) {
        return res.status(404).json({ message: "Scan not found" });
      }

      // Only allow cancelling if scan is in progress
      if (scan.scanStatus !== 'scanning' && scan.scanStatus !== 'pending') {
        return res.status(400).json({ message: "Can only cancel scans that are scanning or pending" });
      }

      const updatedScan = await storage.updateMobileAppScan(req.params.id, req.user.id, { 
        scanStatus: 'failed' 
      });
      res.json(updatedScan);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/mobile-scans/:id/scan", requireAuth, async (req: any, res) => {
    try {
      const scan = await storage.getMobileAppScan(req.params.id, req.user.id);
      if (!scan) {
        return res.status(404).json({ message: "Scan not found" });
      }

      // Update status to scanning
      await storage.updateMobileAppScan(req.params.id, req.user.id, { scanStatus: 'scanning' });

      // Send scan start notification
      await notifyScanStart(storage, scan.userId, scan.id, 'mobile', scan.appName || 'Mobile App Scan');

      // Simulate scanning process (in real app, this would be async job)
      setTimeout(async () => {
        const mockFindings = Math.floor(Math.random() * 15) + 5;
        const critical = Math.floor(Math.random() * 3);
        const high = Math.floor(Math.random() * 5);
        const medium = Math.floor(Math.random() * 5);
        const low = mockFindings - critical - high - medium;

        // Create findings for mobile scan
        const mockFindingTemplates = [
          { title: "Insecure Data Storage", category: "Data Security", cwe: "922", severity: "CRITICAL" },
          { title: "Weak Cryptography", category: "Cryptography", cwe: "327", severity: "CRITICAL" },
          { title: "Insufficient Transport Security", category: "Network Security", cwe: "319", severity: "HIGH" },
          { title: "Improper Certificate Validation", category: "Network Security", cwe: "295", severity: "HIGH" },
          { title: "Insecure Communication", category: "Network Security", cwe: "319", severity: "MEDIUM" },
          { title: "Excessive Permissions", category: "Permissions", cwe: "250", severity: "MEDIUM" },
          { title: "Insufficient Input Validation", category: "Input Validation", cwe: "20", severity: "LOW" },
        ];

        let createdCount = 0;
        for (let i = 0; i < critical && createdCount < mockFindings; i++) {
          const template = mockFindingTemplates[createdCount % mockFindingTemplates.length];
          await storage.createFinding({
            userId: scan.userId,
            title: template.title,
            description: `Critical mobile security vulnerability detected that requires immediate attention.`,
            severity: "CRITICAL",
            category: template.category,
            asset: "Mobile App",
            cwe: template.cwe,
            detected: new Date().toISOString(),
            status: "open",
            location: `MainActivity.java:${Math.floor(Math.random() * 100) + 1}`,
            remediation: `Update mobile app security configuration to address this vulnerability.`,
            aiSuggestion: `AI suggests: Implement proper encryption and secure storage mechanisms.`,
            riskScore: Math.floor(Math.random() * 20) + 80,
            source: "mobile-scan",
            mobileScanId: req.params.id,
            scanId: req.params.id,
            scanType: "mobile",
          });
          createdCount++;
        }
        for (let i = 0; i < high && createdCount < mockFindings; i++) {
          const template = mockFindingTemplates[createdCount % mockFindingTemplates.length];
          await storage.createFinding({
            userId: scan.userId,
            title: template.title,
            description: `High priority mobile security issue that should be addressed soon.`,
            severity: "HIGH",
            category: template.category,
            asset: "Mobile App",
            cwe: template.cwe,
            detected: new Date().toISOString(),
            status: "open",
            location: `NetworkManager.java:${Math.floor(Math.random() * 100) + 1}`,
            remediation: `Review and update mobile app security configuration.`,
            aiSuggestion: `AI suggests: Implement certificate pinning and secure communication protocols.`,
            riskScore: Math.floor(Math.random() * 20) + 60,
            source: "mobile-scan",
            mobileScanId: req.params.id,
            scanId: req.params.id,
            scanType: "mobile",
          });
          createdCount++;
        }
        for (let i = 0; i < medium && createdCount < mockFindings; i++) {
          const template = mockFindingTemplates[createdCount % mockFindingTemplates.length];
          await storage.createFinding({
            userId: scan.userId,
            title: template.title,
            description: `Medium priority mobile security issue.`,
            severity: "MEDIUM",
            category: template.category,
            asset: "Mobile App",
            cwe: template.cwe,
            detected: new Date().toISOString(),
            status: "open",
            location: `PermissionsManager.java:${Math.floor(Math.random() * 100) + 1}`,
            remediation: `Review and optimize app permissions.`,
            aiSuggestion: `AI suggests: Request only necessary permissions and explain their usage to users.`,
            riskScore: Math.floor(Math.random() * 20) + 40,
            source: "mobile-scan",
            mobileScanId: req.params.id,
            scanId: req.params.id,
            scanType: "mobile",
          });
          createdCount++;
        }
        for (let i = 0; i < low && createdCount < mockFindings; i++) {
          const template = mockFindingTemplates[createdCount % mockFindingTemplates.length];
          await storage.createFinding({
            userId: scan.userId,
            title: template.title,
            description: `Low priority mobile security issue.`,
            severity: "LOW",
            category: template.category,
            asset: "Mobile App",
            cwe: template.cwe,
            detected: new Date().toISOString(),
            status: "open",
            location: `InputValidator.java:${Math.floor(Math.random() * 100) + 1}`,
            remediation: `Consider improving input validation.`,
            aiSuggestion: `AI suggests: Add comprehensive input validation for all user inputs.`,
            riskScore: Math.floor(Math.random() * 20) + 10,
            source: "mobile-scan",
            mobileScanId: req.params.id,
            scanId: req.params.id,
            scanType: "mobile",
          });
          createdCount++;
        }

        await storage.updateMobileAppScan(req.params.id, req.user.id, {
          scanStatus: 'completed',
          findingsCount: mockFindings,
          criticalCount: critical,
          highCount: high,
          mediumCount: medium,
          lowCount: low,
          scannedAt: new Date(),
        });

        // Send push notification for scan completion
        await notifyScanComplete(
          storage,
          scan.userId,
          req.params.id,
          'mobile',
          'Mobile App Scan',
          mockFindings
        );
      }, 2000);

      res.json({ message: "Scan started" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Validate fixes before uploading mobile app scan
  app.post("/api/mobile-scans/:id/validate-upload", requireAuth, async (req: any, res) => {
    try {
      const scan = await storage.getMobileAppScan(req.params.id, req.user.id);
      if (!scan || scan.userId !== req.user.id) {
        return res.status(404).json({ message: "Scan not found" });
      }

      // Simulate validation - in production this would analyze the entire codebase
      const shouldFail = Math.random() < 0.25; // 25% chance of conflicts
      
      if (shouldFail) {
        res.json({
          isValid: false,
          issues: [
            "API endpoint changes may break mobile authentication flow",
            "Database schema update requires migration in ProductService.swift:234",
            "New permission requirement affects AndroidManifest.xml"
          ],
          fileLocations: [
            {
              file: "ios/Services/AuthService.swift",
              line: 89,
              function: "handleTokenRefresh",
              description: "Update API endpoint call to match new authentication flow"
            },
            {
              file: "android/app/src/main/java/com/app/services/ProductService.kt",
              line: 234,
              function: "fetchProducts",
              description: "Add database migration for new schema fields"
            },
            {
              file: "android/app/src/main/AndroidManifest.xml",
              line: 45,
              function: null,
              description: "Add new camera permission for security scanning feature"
            }
          ]
        });
      } else {
        res.json({
          isValid: true,
          issues: [],
          fileLocations: []
        });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/mobile-scans/:id/upload", requireAuth, async (req: any, res) => {
    try {
      const { withFixes } = req.body;
      const scan = await storage.getMobileAppScan(req.params.id, req.user.id);
      
      if (!scan) {
        return res.status(404).json({ message: "Scan not found" });
      }

      // If uploading with fixes, mark all findings for this scan as resolved
      if (withFixes) {
        await applyFixesForScan(req.params.id, 'mobile', req.user.id);
      }

      // Update upload status
      await storage.updateMobileAppScan(req.params.id, req.user.id, { 
        uploadStatus: 'pending',
        uploadProgress: 'connecting'
      });

      // Simulate multi-step upload process
      // Step 1: Connecting (1.5s)
      setTimeout(async () => {
        await storage.updateMobileAppScan(req.params.id, req.user.id, {
          uploadProgress: 'uploading'
        });
      }, 1500);

      // Step 2: Uploading (2s)
      setTimeout(async () => {
        await storage.updateMobileAppScan(req.params.id, req.user.id, {
          uploadProgress: 'finalizing'
        });
      }, 3500);

      // Step 3: Finalizing (1.5s)
      setTimeout(async () => {
        await storage.updateMobileAppScan(req.params.id, req.user.id, {
          uploadStatus: 'uploaded',
          uploadProgress: 'idle',
          uploadedAt: new Date(),
        });

        // Send push notification for upload completion
        await notifyUploadComplete(
          storage,
          scan.userId,
          req.params.id,
          'mobile',
          scan.platform || 'App Store'
        );
      }, 5000);

      res.json({ 
        message: `Upload ${withFixes ? 'with fixes' : 'without fixes'} initiated`,
        withFixes 
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/mobile-scans/:id/upload-and-test", requireAuth, async (req: any, res) => {
    try {
      const { withFixes } = req.body;
      const scan = await storage.getMobileAppScan(req.params.id, req.user.id);
      
      if (!scan) {
        return res.status(404).json({ message: "Scan not found" });
      }

      // If uploading with fixes, mark all findings for this scan as resolved
      if (withFixes) {
        await applyFixesForScan(req.params.id, 'mobile', req.user.id);
      }

      // Start upload and testing
      await storage.updateMobileAppScan(req.params.id, req.user.id, { 
        uploadStatus: 'pending',
        uploadProgress: 'connecting',
        testStatus: 'running'
      });

      // Simulate upload progress
      setTimeout(async () => {
        await storage.updateMobileAppScan(req.params.id, req.user.id, {
          uploadProgress: 'uploading'
        });
      }, 1500);

      setTimeout(async () => {
        await storage.updateMobileAppScan(req.params.id, req.user.id, {
          uploadProgress: 'finalizing'
        });
      }, 3500);

      // Complete upload and run comprehensive tests
      setTimeout(async () => {
        try {
          await storage.updateMobileAppScan(req.params.id, req.user.id, {
            uploadStatus: 'uploaded',
            uploadProgress: 'idle',
            uploadedAt: new Date(),
          });

          // Run comprehensive tests
          const testResults = await runComprehensiveTests(storage, req.user.id, req.params.id, 'mobile');
          
          // Update test results
          await storage.updateMobileAppScan(req.params.id, req.user.id, {
            testStatus: testResults.overallStatus,
            testSummary: testResults.summary,
            testDetails: JSON.stringify(testResults),
            testedAt: new Date(),
          });

          // Send push notification
          await notifyUploadComplete(
            storage,
            scan.userId,
            req.params.id,
            'mobile',
            scan.platform || 'App Store'
          );
        } catch (error: any) {
          console.error('Error in upload-with-tests workflow:', error);
        }
      }, 5000);

      res.json({ 
        message: `Upload with comprehensive testing initiated`,
        withFixes 
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // MVP Code Scan endpoints
  app.get("/api/mvp-scans", requireAuth, async (req: any, res) => {
    try {
      const scans = await storage.getAllMvpCodeScans(req.user.id);
      res.json(scans);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/mvp-scans/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      const scan = await storage.getMvpCodeScan(req.params.id, userId);
      if (!scan || scan.userId !== userId) {
        return res.status(404).json({ message: "Scan not found" });
      }
      
      // Calculate real-time finding counts
      const counts = await storage.getFindingCountsByScan(req.params.id, userId);
      
      // Always update scan record to keep it in sync (check all counts including medium/low)
      if (scan.findingsCount !== counts.findingsCount || 
          scan.criticalCount !== counts.criticalCount || 
          scan.highCount !== counts.highCount ||
          scan.mediumCount !== counts.mediumCount ||
          scan.lowCount !== counts.lowCount) {
        await storage.updateMvpCodeScan(req.params.id, userId, counts);
      }
      
      // Return enriched scan data
      res.json({
        ...scan,
        ...counts,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/mvp-scans/:id/findings", requireAuth, async (req: any, res) => {
    try {
      const scan = await storage.getMvpCodeScan(req.params.id, req.user.id);
      if (!scan || scan.userId !== req.user.id) {
        return res.status(404).json({ message: "Scan not found" });
      }
      const findings = await storage.getFindingsByScan(req.params.id, req.user.id, "mvp");
      res.json(findings);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/mvp-scans", requireAuth, async (req, res) => {
    try {
      const validatedData = insertMvpCodeScanSchema.omit({ userId: true }).parse(req.body);
      const scan = await storage.createMvpCodeScan({
        ...validatedData,
        userId: req.user.id,
      });
      res.status(201).json(scan);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/mvp-scans/:id", requireAuth, async (req: any, res) => {
    try {
      const scan = await storage.getMvpCodeScan(req.params.id, req.user.id);
      if (!scan || scan.userId !== req.user.id) {
        return res.status(404).json({ message: "Scan not found" });
      }

      // Only allow editing specific fields (not platform to avoid invalidating results)
      const validatedData = updateMvpCodeScanSchema.parse(req.body);
      
      // Reject empty PATCH bodies (true PATCH semantics)
      if (Object.keys(validatedData).length === 0) {
        return res.status(400).json({ message: "No fields to update" });
      }

      const updatedScan = await storage.updateMvpCodeScan(req.params.id, req.user.id, validatedData);
      res.json(updatedScan);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/mvp-scans/:id", requireAuth, async (req: any, res) => {
    try {
      const scan = await storage.getMvpCodeScan(req.params.id, req.user.id);
      if (!scan || scan.userId !== req.user.id) {
        return res.status(404).json({ message: "Scan not found" });
      }

      await storage.deleteMvpCodeScan(req.params.id, req.user.id);
      res.json({ success: true, message: "Scan deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/mvp-scans/:id/cancel", requireAuth, async (req: any, res) => {
    try {
      const scan = await storage.getMvpCodeScan(req.params.id, req.user.id);
      if (!scan || scan.userId !== req.user.id) {
        return res.status(404).json({ message: "Scan not found" });
      }

      // Only allow cancelling if scan is in progress
      if (scan.scanStatus !== 'scanning' && scan.scanStatus !== 'pending') {
        return res.status(400).json({ message: "Can only cancel scans that are scanning or pending" });
      }

      const updatedScan = await storage.updateMvpCodeScan(req.params.id, req.user.id, { 
        scanStatus: 'failed' 
      });
      res.json(updatedScan);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/mvp-scans/:id/scan", requireAuth, async (req: any, res) => {
    try {
      const scan = await storage.getMvpCodeScan(req.params.id, req.user.id);
      if (!scan) {
        return res.status(404).json({ message: "Scan not found" });
      }

      await storage.updateMvpCodeScan(req.params.id, req.user.id, { scanStatus: 'scanning' });

      // Send scan start notification
      await notifyScanStart(storage, scan.userId, scan.id, 'mvp', scan.projectName || 'MVP Code Scan');

      setTimeout(async () => {
        const critical = Math.floor(Math.random() * 4);
        const high = Math.floor(Math.random() * 6);
        const medium = Math.floor(Math.random() * 7);
        const mockFindings = critical + high + medium + Math.floor(Math.random() * 10);
        const low = mockFindings - critical - high - medium;

        // Generate mock findings
        const mockFindingTemplates = [
          { title: "Hardcoded API Keys", category: "Secrets Detection", cwe: "798", severity: "CRITICAL" },
          { title: "SQL Injection Vulnerability", category: "Input Validation", cwe: "89", severity: "CRITICAL" },
          { title: "Cross-Site Scripting (XSS)", category: "Input Validation", cwe: "79", severity: "HIGH" },
          { title: "Insecure Deserialization", category: "Unsafe Deserialization", cwe: "502", severity: "HIGH" },
          { title: "Broken Authentication", category: "Authentication", cwe: "287", severity: "HIGH" },
          { title: "Missing Input Validation", category: "Input Validation", cwe: "20", severity: "MEDIUM" },
          { title: "Insecure Direct Object References", category: "Access Control", cwe: "639", severity: "MEDIUM" },
          { title: "Security Misconfiguration", category: "Configuration", cwe: "16", severity: "MEDIUM" },
          { title: "Weak Password Requirements", category: "Authentication", cwe: "521", severity: "LOW" },
          { title: "Missing Security Headers", category: "Headers", cwe: "16", severity: "LOW" },
        ];

        // Create findings for each severity level
        let createdCount = 0;
        for (let i = 0; i < critical && createdCount < mockFindings; i++) {
          const template = mockFindingTemplates[createdCount % mockFindingTemplates.length];
          await storage.createFinding({
            userId: scan.userId,
            title: template.title,
            description: `Critical security issue detected in your codebase that requires immediate attention.`,
            severity: "CRITICAL",
            category: template.category,
            asset: "Source Code",
            cwe: template.cwe,
            detected: new Date().toISOString(),
            status: "open",
            location: `src/main.ts:${Math.floor(Math.random() * 100) + 1}`,
            remediation: `Update your code to remove this vulnerability. Apply security best practices and use proper validation.`,
            aiSuggestion: `AI suggests: Implement proper security controls and remove sensitive data from code. Use environment variables for secrets.`,
            riskScore: Math.floor(Math.random() * 20) + 80,
            source: "mvp-scan",
            mvpScanId: req.params.id,
            scanId: req.params.id,
            scanType: "mvp",
          });
          createdCount++;
        }
        for (let i = 0; i < high && createdCount < mockFindings; i++) {
          const template = mockFindingTemplates[createdCount % mockFindingTemplates.length];
          await storage.createFinding({
            userId: scan.userId,
            title: template.title,
            description: `High priority security issue that should be addressed soon.`,
            severity: "HIGH",
            category: template.category,
            asset: "Source Code",
            cwe: template.cwe,
            detected: new Date().toISOString(),
            status: "open",
            location: `src/components/App.tsx:${Math.floor(Math.random() * 100) + 1}`,
            remediation: `Review and update the affected code to fix this security issue.`,
            aiSuggestion: `AI suggests: Implement input sanitization and proper security controls to mitigate this vulnerability.`,
            riskScore: Math.floor(Math.random() * 20) + 60,
            source: "mvp-scan",
            mvpScanId: req.params.id,
            scanId: req.params.id,
            scanType: "mvp",
          });
          createdCount++;
        }
        for (let i = 0; i < medium && createdCount < mockFindings; i++) {
          const template = mockFindingTemplates[createdCount % mockFindingTemplates.length];
          await storage.createFinding({
            userId: scan.userId,
            title: template.title,
            description: `Medium priority security issue that should be reviewed.`,
            severity: "MEDIUM",
            category: template.category,
            asset: "Configuration",
            cwe: template.cwe,
            detected: new Date().toISOString(),
            status: "open",
            location: `config/settings.json:${Math.floor(Math.random() * 50) + 1}`,
            remediation: `Update configuration to follow security best practices.`,
            aiSuggestion: `AI suggests: Review and update configuration settings to improve security posture.`,
            riskScore: Math.floor(Math.random() * 20) + 40,
            source: "mvp-scan",
            mvpScanId: req.params.id,
            scanId: req.params.id,
            scanType: "mvp",
          });
          createdCount++;
        }
        for (let i = 0; i < low && createdCount < mockFindings; i++) {
          const template = mockFindingTemplates[createdCount % mockFindingTemplates.length];
          await storage.createFinding({
            userId: scan.userId,
            title: template.title,
            description: `Low priority security issue for your awareness.`,
            severity: "LOW",
            category: template.category,
            asset: "Documentation",
            cwe: template.cwe,
            detected: new Date().toISOString(),
            status: "open",
            location: `README.md:${Math.floor(Math.random() * 20) + 1}`,
            remediation: `Consider updating documentation and practices.`,
            aiSuggestion: `AI suggests: Review security documentation and update as needed.`,
            riskScore: Math.floor(Math.random() * 20) + 10,
            source: "mvp-scan",
            mvpScanId: req.params.id,
            scanId: req.params.id,
            scanType: "mvp",
          });
          createdCount++;
        }

        // Generate preview URL for QR code
        const previewUrl = `${req.protocol}://${req.get('host')}/preview/${req.params.id}`;

        await storage.updateMvpCodeScan(req.params.id, req.user.id, {
          scanStatus: 'completed',
          findingsCount: mockFindings,
          criticalCount: critical,
          highCount: high,
          mediumCount: medium,
          lowCount: low,
          scannedAt: new Date(),
          previewUrl,
        });

        // Send push notification for scan completion
        await notifyScanComplete(
          storage,
          scan.userId,
          req.params.id,
          'mvp',
          'MVP Code Scan',
          mockFindings
        );
      }, 2500);

      res.json({ message: "Scan started" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Validate fixes before uploading MVP scan
  app.post("/api/mvp-scans/:id/validate-upload", requireAuth, async (req: any, res) => {
    try {
      const scan = await storage.getMvpCodeScan(req.params.id, req.user.id);
      if (!scan || scan.userId !== req.user.id) {
        return res.status(404).json({ message: "Scan not found" });
      }

      // Simulate validation - in production this would analyze the entire codebase
      const shouldFail = Math.random() < 0.25; // 25% chance of conflicts
      
      if (shouldFail) {
        res.json({
          isValid: false,
          issues: [
            "Security patch changes database connection logic used in 3 other services",
            "Authentication update affects session handling in middleware",
            "Input validation change impacts form processing in UserController"
          ],
          fileLocations: [
            {
              file: "server/services/DatabaseService.ts",
              line: 156,
              function: "createConnection",
              description: "Update connection pooling to match new security requirements"
            },
            {
              file: "server/middleware/auth.ts",
              line: 67,
              function: "validateSession",
              description: "Adjust session validation to work with updated token format"
            },
            {
              file: "server/controllers/UserController.ts",
              line: 203,
              function: "handleRegistration",
              description: "Update input sanitization to use new validation library"
            }
          ]
        });
      } else {
        res.json({
          isValid: true,
          issues: [],
          fileLocations: []
        });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/mvp-scans/:id/upload", requireAuth, async (req: any, res) => {
    try {
      const { withFixes } = req.body;
      console.log(`[MVP Upload] Received upload request for scan: ${req.params.id}, withFixes:`, withFixes);
      const scan = await storage.getMvpCodeScan(req.params.id, req.user.id);
      
      if (!scan) {
        return res.status(404).json({ message: "Scan not found" });
      }

      // If uploading with fixes, mark all findings for this scan as resolved
      if (withFixes) {
        console.log(`[MVP Upload] Calling applyFixesForScan...`);
        await applyFixesForScan(req.params.id, 'mvp', req.user.id);
      } else {
        console.log(`[MVP Upload] Skipping fixes because withFixes is:`, withFixes);
      }

      await storage.updateMvpCodeScan(req.params.id, req.user.id, { 
        uploadStatus: 'pending',
        uploadProgress: 'connecting'
      });

      // Simulate multi-step upload process
      // Step 1: Connecting (1.5s)
      setTimeout(async () => {
        await storage.updateMvpCodeScan(req.params.id, req.user.id, {
          uploadProgress: 'uploading'
        });
      }, 1500);

      // Step 2: Uploading (2s)
      setTimeout(async () => {
        await storage.updateMvpCodeScan(req.params.id, req.user.id, {
          uploadProgress: 'finalizing'
        });
      }, 3500);

      // Step 3: Finalizing (1.5s)
      setTimeout(async () => {
        await storage.updateMvpCodeScan(req.params.id, req.user.id, {
          uploadStatus: 'uploaded',
          uploadProgress: 'idle',
          uploadedAt: new Date(),
        });

        // Send push notification for upload completion
        await notifyUploadComplete(
          storage,
          scan.userId,
          req.params.id,
          'mvp',
          scan.platform
        );
      }, 5000);

      res.json({ 
        message: `Upload ${withFixes ? 'with fixes' : 'without fixes'} initiated to ${scan.platform}`,
        withFixes 
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/mvp-scans/:id/upload-and-test", requireAuth, async (req: any, res) => {
    try {
      const { withFixes } = req.body;
      const scan = await storage.getMvpCodeScan(req.params.id, req.user.id);
      
      if (!scan) {
        return res.status(404).json({ message: "Scan not found" });
      }

      // If uploading with fixes, mark all findings for this scan as resolved
      if (withFixes) {
        await applyFixesForScan(req.params.id, 'mvp', req.user.id);
      }

      await storage.updateMvpCodeScan(req.params.id, req.user.id, { 
        uploadStatus: 'pending',
        uploadProgress: 'connecting',
        testStatus: 'running'
      });

      setTimeout(async () => {
        await storage.updateMvpCodeScan(req.params.id, req.user.id, {
          uploadProgress: 'uploading'
        });
      }, 1500);

      setTimeout(async () => {
        await storage.updateMvpCodeScan(req.params.id, req.user.id, {
          uploadProgress: 'finalizing'
        });
      }, 3500);

      setTimeout(async () => {
        try {
          await storage.updateMvpCodeScan(req.params.id, req.user.id, {
            uploadStatus: 'uploaded',
            uploadProgress: 'idle',
            uploadedAt: new Date(),
          });

          const testResults = await runComprehensiveTests(storage, req.user.id, req.params.id, 'mvp');
          
          await storage.updateMvpCodeScan(req.params.id, req.user.id, {
            testStatus: testResults.overallStatus,
            testSummary: testResults.summary,
            testDetails: JSON.stringify(testResults),
            testedAt: new Date(),
          });

          await notifyUploadComplete(
            storage,
            scan.userId,
            req.params.id,
            'mvp',
            scan.platform
          );
        } catch (error: any) {
          console.error('Error in upload-with-tests workflow:', error);
        }
      }, 5000);

      res.json({ 
        message: `Upload with comprehensive testing initiated`,
        withFixes 
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // QR Code generation endpoint for MVP scans
  app.get("/api/mvp-scans/:id/qrcode", requireAuth, async (req: any, res) => {
    try {
      const scan = await storage.getMvpCodeScan(req.params.id, req.user.id);
      
      if (!scan || !scan.previewUrl) {
        return res.status(404).json({ message: "Preview URL not found" });
      }

      // Generate QR code as data URL
      const qrCodeDataUrl = await QRCode.toDataURL(scan.previewUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      res.json({ qrCode: qrCodeDataUrl, previewUrl: scan.previewUrl });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // App store upload endpoint for MVP scans
  app.post("/api/mvp-scans/:id/upload-to-store", requireAuth, async (req: any, res) => {
    try {
      const { withFixes, targetAppStore, appStoreBundleId } = req.body;
      const scan = await storage.getMvpCodeScan(req.params.id, req.user.id);
      
      if (!scan) {
        return res.status(404).json({ message: "Scan not found" });
      }

      // Update scan with app store info and initiate upload
      await storage.updateMvpCodeScan(req.params.id, req.user.id, { 
        targetAppStore,
        appStoreBundleId,
        appStoreUploadStatus: 'pending',
        appStoreUploadProgress: 'connecting'
      });

      // Simulate multi-step upload process to app store
      // Step 1: Connecting (1.5s)
      setTimeout(async () => {
        await storage.updateMvpCodeScan(req.params.id, req.user.id, {
          appStoreUploadProgress: 'uploading'
        });
      }, 1500);

      // Step 2: Uploading (2s)
      setTimeout(async () => {
        await storage.updateMvpCodeScan(req.params.id, req.user.id, {
          appStoreUploadProgress: 'finalizing'
        });
      }, 3500);

      // Step 3: Finalizing (1.5s)
      setTimeout(async () => {
        await storage.updateMvpCodeScan(req.params.id, req.user.id, {
          appStoreUploadStatus: 'uploaded',
          appStoreUploadProgress: 'idle',
        });
      }, 5000);

      const storeName = targetAppStore === 'ios' ? 'iOS App Store' : 'Android Play Store';
      res.json({ 
        message: `Upload ${withFixes ? 'with fixes' : 'without fixes'} initiated to ${storeName}`,
        withFixes,
        targetAppStore
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Web App Scan endpoints
  app.get("/api/web-scans", requireAuth, async (req: any, res) => {
    try {
      const scans = await storage.getAllWebAppScans(req.user.id);
      res.json(scans);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/web-scans/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      const scan = await storage.getWebAppScan(req.params.id, userId);
      if (!scan || scan.userId !== userId) {
        return res.status(404).json({ message: "Scan not found" });
      }
      
      // Calculate real-time finding counts
      const counts = await storage.getFindingCountsByScan(req.params.id, userId);
      
      // Always update scan record to keep it in sync
      if (scan.findingsCount !== counts.findingsCount || 
          scan.criticalCount !== counts.criticalCount || 
          scan.highCount !== counts.highCount ||
          scan.mediumCount !== counts.mediumCount ||
          scan.lowCount !== counts.lowCount) {
        await storage.updateWebAppScan(req.params.id, userId, counts);
      }
      
      // Return enriched scan data
      res.json({
        ...scan,
        ...counts,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/web-scans/:id/findings", requireAuth, async (req: any, res) => {
    try {
      const scan = await storage.getWebAppScan(req.params.id, req.user.id);
      if (!scan || scan.userId !== req.user.id) {
        return res.status(404).json({ message: "Scan not found" });
      }
      const findings = await storage.getFindingsByScan(req.params.id, req.user.id, "web");
      res.json(findings);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/web-scans", requireAuth, async (req, res) => {
    try {
      const validatedData = insertWebAppScanSchema.omit({ userId: true }).parse(req.body);
      const scan = await storage.createWebAppScan({
        ...validatedData,
        userId: req.user.id,
      });
      res.status(201).json(scan);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/web-scans/:id", requireAuth, async (req: any, res) => {
    try {
      const scan = await storage.getWebAppScan(req.params.id, req.user.id);
      if (!scan || scan.userId !== req.user.id) {
        return res.status(404).json({ message: "Scan not found" });
      }

      // Only allow editing specific fields (not hostingPlatform to avoid invalidating results)
      const validatedData = updateWebAppScanSchema.parse(req.body);
      
      // Reject empty PATCH bodies (true PATCH semantics)
      if (Object.keys(validatedData).length === 0) {
        return res.status(400).json({ message: "No fields to update" });
      }

      const updatedScan = await storage.updateWebAppScan(req.params.id, req.user.id, validatedData);
      res.json(updatedScan);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/web-scans/:id", requireAuth, async (req: any, res) => {
    try {
      const scan = await storage.getWebAppScan(req.params.id, req.user.id);
      if (!scan || scan.userId !== req.user.id) {
        return res.status(404).json({ message: "Scan not found" });
      }

      await storage.deleteWebAppScan(req.params.id, req.user.id);
      res.json({ success: true, message: "Scan deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/web-scans/:id/cancel", requireAuth, async (req: any, res) => {
    try {
      const scan = await storage.getWebAppScan(req.params.id, req.user.id);
      if (!scan || scan.userId !== req.user.id) {
        return res.status(404).json({ message: "Scan not found" });
      }

      // Only allow cancelling if scan is in progress
      if (scan.scanStatus !== 'scanning' && scan.scanStatus !== 'pending') {
        return res.status(400).json({ message: "Can only cancel scans that are scanning or pending" });
      }

      const updatedScan = await storage.updateWebAppScan(req.params.id, req.user.id, { 
        scanStatus: 'failed' 
      });
      res.json(updatedScan);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/web-scans/:id/scan", requireAuth, async (req: any, res) => {
    try {
      const scan = await storage.getWebAppScan(req.params.id, req.user.id);
      if (!scan) {
        return res.status(404).json({ message: "Scan not found" });
      }

      await storage.updateWebAppScan(req.params.id, req.user.id, { scanStatus: 'scanning' });

      // Send scan start notification
      await notifyScanStart(storage, scan.userId, scan.id, 'web', scan.appName || 'Web App Scan');

      setTimeout(async () => {
        const mockFindings = Math.floor(Math.random() * 25) + 15;
        const critical = Math.floor(Math.random() * 5);
        const high = Math.floor(Math.random() * 8);
        const medium = Math.floor(Math.random() * 8);
        const low = mockFindings - critical - high - medium;

        // Create findings for web scan
        const mockFindingTemplates = [
          { title: "SQL Injection", category: "Input Validation", cwe: "89", severity: "CRITICAL" },
          { title: "Cross-Site Scripting (XSS)", category: "Input Validation", cwe: "79", severity: "CRITICAL" },
          { title: "Broken Authentication", category: "Authentication", cwe: "287", severity: "HIGH" },
          { title: "Sensitive Data Exposure", category: "Data Security", cwe: "311", severity: "HIGH" },
          { title: "XML External Entities (XXE)", category: "Input Validation", cwe: "611", severity: "HIGH" },
          { title: "Security Misconfiguration", category: "Configuration", cwe: "16", severity: "MEDIUM" },
          { title: "Cross-Site Request Forgery (CSRF)", category: "Session Management", cwe: "352", severity: "MEDIUM" },
          { title: "Insufficient Logging & Monitoring", category: "Logging", cwe: "778", severity: "LOW" },
        ];

        let createdCount = 0;
        for (let i = 0; i < critical && createdCount < mockFindings; i++) {
          const template = mockFindingTemplates[createdCount % mockFindingTemplates.length];
          await storage.createFinding({
            userId: scan.userId,
            title: template.title,
            description: `Critical web security vulnerability detected that requires immediate attention.`,
            severity: "CRITICAL",
            category: template.category,
            asset: "Web Application",
            cwe: template.cwe,
            detected: new Date().toISOString(),
            status: "open",
            location: `/api/users:${Math.floor(Math.random() * 100) + 1}`,
            remediation: `Implement proper input validation and security controls to prevent this vulnerability.`,
            aiSuggestion: `AI suggests: Use parameterized queries and proper input sanitization to prevent injection attacks.`,
            riskScore: Math.floor(Math.random() * 20) + 80,
            source: "web-scan",
            webScanId: req.params.id,
            scanId: req.params.id,
            scanType: "web",
          });
          createdCount++;
        }
        for (let i = 0; i < high && createdCount < mockFindings; i++) {
          const template = mockFindingTemplates[createdCount % mockFindingTemplates.length];
          await storage.createFinding({
            userId: scan.userId,
            title: template.title,
            description: `High priority web security issue that should be addressed soon.`,
            severity: "HIGH",
            category: template.category,
            asset: "Web Application",
            cwe: template.cwe,
            detected: new Date().toISOString(),
            status: "open",
            location: `/api/auth:${Math.floor(Math.random() * 100) + 1}`,
            remediation: `Review and update authentication and security mechanisms.`,
            aiSuggestion: `AI suggests: Implement multi-factor authentication and secure session management.`,
            riskScore: Math.floor(Math.random() * 20) + 60,
            source: "web-scan",
            webScanId: req.params.id,
            scanId: req.params.id,
            scanType: "web",
          });
          createdCount++;
        }
        for (let i = 0; i < medium && createdCount < mockFindings; i++) {
          const template = mockFindingTemplates[createdCount % mockFindingTemplates.length];
          await storage.createFinding({
            userId: scan.userId,
            title: template.title,
            description: `Medium priority web security issue.`,
            severity: "MEDIUM",
            category: template.category,
            asset: "Web Application",
            cwe: template.cwe,
            detected: new Date().toISOString(),
            status: "open",
            location: `/api/config:${Math.floor(Math.random() * 50) + 1}`,
            remediation: `Review and improve security configuration.`,
            aiSuggestion: `AI suggests: Follow security best practices for web application configuration.`,
            riskScore: Math.floor(Math.random() * 20) + 40,
            source: "web-scan",
            webScanId: req.params.id,
            scanId: req.params.id,
            scanType: "web",
          });
          createdCount++;
        }
        for (let i = 0; i < low && createdCount < mockFindings; i++) {
          const template = mockFindingTemplates[createdCount % mockFindingTemplates.length];
          await storage.createFinding({
            userId: scan.userId,
            title: template.title,
            description: `Low priority web security issue.`,
            severity: "LOW",
            category: template.category,
            asset: "Web Application",
            cwe: template.cwe,
            detected: new Date().toISOString(),
            status: "open",
            location: `/api/logs:${Math.floor(Math.random() * 20) + 1}`,
            remediation: `Consider improving logging and monitoring capabilities.`,
            aiSuggestion: `AI suggests: Implement comprehensive logging for security events.`,
            riskScore: Math.floor(Math.random() * 20) + 10,
            source: "web-scan",
            webScanId: req.params.id,
            scanId: req.params.id,
            scanType: "web",
          });
          createdCount++;
        }

        await storage.updateWebAppScan(req.params.id, req.user.id, {
          scanStatus: 'completed',
          findingsCount: mockFindings,
          criticalCount: critical,
          highCount: high,
          mediumCount: medium,
          lowCount: low,
          scannedAt: new Date(),
        });

        // Send push notification for scan completion
        await notifyScanComplete(
          storage,
          scan.userId,
          req.params.id,
          'web',
          'Web App Scan',
          mockFindings
        );
      }, 3000);

      res.json({ message: "Scan started" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Validate fixes before uploading web app scan
  app.post("/api/web-scans/:id/validate-upload", requireAuth, async (req: any, res) => {
    try {
      const scan = await storage.getWebAppScan(req.params.id, req.user.id);
      if (!scan || scan.userId !== req.user.id) {
        return res.status(404).json({ message: "Scan not found" });
      }

      // Simulate validation - in production this would analyze the entire codebase
      const shouldFail = Math.random() < 0.25; // 25% chance of conflicts
      
      if (shouldFail) {
        res.json({
          isValid: false,
          issues: [
            "XSS protection update changes component render logic in 5 React components",
            "CSRF token implementation affects form submission flow",
            "CORS policy update may block existing third-party integrations"
          ],
          fileLocations: [
            {
              file: "client/src/components/CommentSection.tsx",
              line: 78,
              function: "renderComment",
              description: "Update sanitization to use new DOMPurify configuration"
            },
            {
              file: "client/src/hooks/useFormSubmit.ts",
              line: 34,
              function: "handleSubmit",
              description: "Include CSRF token in all form submissions"
            },
            {
              file: "server/config/cors.ts",
              line: 12,
              function: null,
              description: "Add trusted third-party domains to CORS whitelist"
            }
          ]
        });
      } else {
        res.json({
          isValid: true,
          issues: [],
          fileLocations: []
        });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/web-scans/:id/upload", requireAuth, async (req: any, res) => {
    try {
      const { withFixes } = req.body;
      const scan = await storage.getWebAppScan(req.params.id, req.user.id);
      
      if (!scan) {
        return res.status(404).json({ message: "Scan not found" });
      }

      // If uploading with fixes, mark all findings for this scan as resolved
      if (withFixes) {
        await applyFixesForScan(req.params.id, 'web', req.user.id);
      }

      await storage.updateWebAppScan(req.params.id, req.user.id, { 
        uploadStatus: 'pending',
        uploadProgress: 'connecting'
      });

      // Simulate multi-step upload process
      // Step 1: Connecting (1.5s)
      setTimeout(async () => {
        await storage.updateWebAppScan(req.params.id, req.user.id, {
          uploadProgress: 'uploading'
        });
      }, 1500);

      // Step 2: Uploading (2s)
      setTimeout(async () => {
        await storage.updateWebAppScan(req.params.id, req.user.id, {
          uploadProgress: 'finalizing'
        });
      }, 3500);

      // Step 3: Finalizing (1.5s)
      setTimeout(async () => {
        await storage.updateWebAppScan(req.params.id, req.user.id, {
          uploadStatus: 'uploaded',
          uploadProgress: 'idle',
          uploadedAt: new Date(),
        });

        // Send push notification for upload completion
        await notifyUploadComplete(
          storage,
          scan.userId,
          req.params.id,
          'web',
          scan.hostingPlatform || 'hosting platform'
        );
      }, 5000);

      res.json({ 
        message: `Upload ${withFixes ? 'with fixes' : 'without fixes'} initiated to ${scan.hostingPlatform}`,
        withFixes 
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/web-scans/:id/upload-and-test", requireAuth, async (req: any, res) => {
    try {
      const { withFixes, destination } = req.body;
      const scan = await storage.getWebAppScan(req.params.id, req.user.id);
      
      if (!scan) {
        return res.status(404).json({ message: "Scan not found" });
      }

      // If uploading with fixes, mark all findings for this scan as resolved
      if (withFixes) {
        await applyFixesForScan(req.params.id, 'web', req.user.id);
      }

      // Phase 1: Run comprehensive tests first (before upload)
      await storage.updateWebAppScan(req.params.id, req.user.id, { 
        testStatus: 'running',
        uploadStatus: 'pending',
        uploadProgress: 'testing'
      });

      // Simulate test execution
      setTimeout(async () => {
        try {
          const testResults = await runComprehensiveTests(storage, req.user.id, req.params.id, 'web');
          
          await storage.updateWebAppScan(req.params.id, req.user.id, {
            testStatus: testResults.overallStatus,
            testSummary: testResults.summary,
            testDetails: JSON.stringify(testResults),
            testedAt: new Date(),
          });

          // If tests failed, stop here and don't upload
          if (testResults.overallStatus === 'failed') {
            await storage.updateWebAppScan(req.params.id, req.user.id, {
              uploadStatus: 'idle',
              uploadProgress: 'idle',
            });
            return;
          }

          // Phase 2: Tests passed, proceed with upload
          await storage.updateWebAppScan(req.params.id, req.user.id, {
            uploadProgress: 'connecting'
          });

          setTimeout(async () => {
            await storage.updateWebAppScan(req.params.id, req.user.id, {
              uploadProgress: 'uploading'
            });
          }, 1500);

          setTimeout(async () => {
            await storage.updateWebAppScan(req.params.id, req.user.id, {
              uploadProgress: 'finalizing'
            });
          }, 2500);

          setTimeout(async () => {
            await storage.updateWebAppScan(req.params.id, req.user.id, {
              uploadStatus: 'uploaded',
              uploadProgress: 'idle',
              uploadedAt: new Date(),
            });

            await notifyUploadComplete(
              storage,
              scan.userId,
              req.params.id,
              'web',
              scan.hostingPlatform || destination || 'hosting platform'
            );
          }, 4000);
        } catch (error: any) {
          console.error('Error in upload-and-test workflow:', error);
          await storage.updateWebAppScan(req.params.id, req.user.id, {
            uploadStatus: 'failed',
            uploadProgress: 'idle',
            testStatus: 'failed',
          });
        }
      }, 3000);

      res.json({ 
        message: `Testing application before upload...`,
        withFixes 
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Report endpoints
  app.get("/api/reports", requireAuth, async (req: any, res) => {
    try {
      const reports = await storage.getAllReports(req.user.id);
      res.json(reports);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/reports/:id", requireAuth, async (req: any, res) => {
    try {
      const report = await storage.getReport(req.params.id, req.user.id);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }
      res.json(report);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/reports", requireAuth, async (req: any, res) => {
    try {
      const validatedData = insertReportSchema.omit({ userId: true }).parse(req.body);
      const report = await storage.createReport({
        ...validatedData,
        userId: req.user.id,
      });
      
      // Simulate report generation
      setTimeout(async () => {
        await storage.updateReport(report.id, report.userId, {
          status: 'generated',
          generatedAt: new Date(),
        });
      }, 2000);

      res.status(201).json(report);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/reports/:id/download/pdf", requireAuth, async (req: any, res) => {
    try {
      const report = await storage.getReport(req.params.id, req.user.id);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      // Generate PDF using pdfkit
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });

      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${report.name.replace(/[^a-z0-9]/gi, '_')}.pdf"`);

      // Pipe the PDF directly to response
      doc.pipe(res);

      // Handle PDF generation errors
      doc.on('error', (err) => {
        console.error('PDF generation error:', err);
        if (!res.headersSent) {
          res.status(500).json({ message: 'PDF generation failed' });
        }
      });

      // Add content
      doc.fontSize(20).font('Helvetica-Bold').text('AEGIS AUDITOR', { align: 'center' });
      doc.fontSize(16).text('Security Report', { align: 'center' });
      doc.moveDown(2);

      doc.fontSize(12).font('Helvetica-Bold').text('Report Information');
      doc.fontSize(10).font('Helvetica');
      doc.text(`Report Name: ${report.name}`);
      doc.text(`Type: ${report.type}`);
      doc.text(`Status: ${report.status}`);
      doc.text(`Generated: ${report.generatedAt ? new Date(report.generatedAt).toLocaleString() : 'Pending'}`);
      doc.text(`Report ID: ${report.id}`);
      doc.text(`Created: ${new Date(report.createdAt).toLocaleString()}`);
      doc.moveDown(2);

      doc.fontSize(12).font('Helvetica-Bold').text('Findings Summary');
      doc.fontSize(10).font('Helvetica');
      doc.text(`Total Findings: ${report.totalFindings || 0}`);
      doc.text(`  • Critical: ${report.criticalCount || 0}`, { indent: 20 });
      doc.text(`  • High: ${report.highCount || 0}`, { indent: 20 });
      doc.text(`  • Medium: ${report.mediumCount || 0}`, { indent: 20 });
      doc.text(`  • Low: ${report.lowCount || 0}`, { indent: 20 });
      doc.moveDown(2);

      // Add note
      doc.fontSize(8).font('Helvetica-Oblique');
      doc.text('This report was generated by Aithon Shield - Enterprise Cybersecurity Testing Platform', {
        align: 'center'
      });

      // Finalize PDF
      doc.end();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/reports/:id/download/json", requireAuth, async (req: any, res) => {
    try {
      const report = await storage.getReport(req.params.id, req.user.id);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${report.name.replace(/[^a-z0-9]/gi, '_')}.json"`);
      res.json(report);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/reports/:id/download/html", requireAuth, async (req: any, res) => {
    try {
      const report = await storage.getReport(req.params.id, req.user.id);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      // Generate HTML content
      const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${report.name} - Aithon Shield Security Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      background: #f9fafb;
      padding: 2rem;
    }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 3rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .header { border-bottom: 3px solid #3b82f6; padding-bottom: 2rem; margin-bottom: 2rem; }
    .logo { font-size: 2rem; font-weight: bold; color: #3b82f6; margin-bottom: 0.5rem; }
    h1 { font-size: 2rem; color: #111827; margin: 1rem 0; }
    h2 { font-size: 1.5rem; color: #374151; margin: 2rem 0 1rem; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.5rem; }
    .meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin: 2rem 0; }
    .meta-item { background: #f3f4f6; padding: 1rem; border-radius: 6px; }
    .meta-label { font-size: 0.875rem; color: #6b7280; margin-bottom: 0.25rem; }
    .meta-value { font-size: 1.25rem; font-weight: 600; color: #111827; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin: 2rem 0; }
    .summary-card { text-align: center; padding: 1.5rem; border-radius: 6px; }
    .critical { background: #fee2e2; color: #991b1b; }
    .high { background: #fed7aa; color: #9a3412; }
    .medium { background: #fef3c7; color: #92400e; }
    .low { background: #e5e7eb; color: #374151; }
    .summary-count { font-size: 2rem; font-weight: bold; display: block; }
    .summary-label { font-size: 0.875rem; margin-top: 0.5rem; }
    .scan-list { list-style: none; }
    .scan-item { background: #f9fafb; padding: 1rem; margin: 0.5rem 0; border-radius: 6px; border-left: 4px solid #3b82f6; }
    .footer { margin-top: 3rem; padding-top: 2rem; border-top: 2px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 0.875rem; }
    .badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.875rem; font-weight: 500; }
    .badge-generated { background: #dbeafe; color: #1e40af; }
    .badge-pending { background: #f3f4f6; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🛡️ Aithon Shield</div>
      <h1>${report.name}</h1>
      <span class="badge ${report.status === 'generated' ? 'badge-generated' : 'badge-pending'}">
        ${report.status.toUpperCase()}
      </span>
    </div>

    <div class="meta">
      <div class="meta-item">
        <div class="meta-label">Report Type</div>
        <div class="meta-value">${report.type}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Generated</div>
        <div class="meta-value">${report.generatedAt ? new Date(report.generatedAt).toLocaleDateString() : 'Pending'}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Total Scans</div>
        <div class="meta-value">${report.scanIds?.length || 0}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Total Findings</div>
        <div class="meta-value">${report.totalFindings}</div>
      </div>
    </div>

    <h2>Security Summary</h2>
    <div class="summary">
      <div class="summary-card critical">
        <span class="summary-count">${report.criticalCount}</span>
        <span class="summary-label">Critical</span>
      </div>
      <div class="summary-card high">
        <span class="summary-count">${report.highCount}</span>
        <span class="summary-label">High</span>
      </div>
      <div class="summary-card medium">
        <span class="summary-count">${report.mediumCount}</span>
        <span class="summary-label">Medium</span>
      </div>
      <div class="summary-card low">
        <span class="summary-count">${report.lowCount}</span>
        <span class="summary-label">Low</span>
      </div>
    </div>

    <h2>Included Scans</h2>
    <ul class="scan-list">
      ${report.scanIds?.map((scanId: string) => `<li class="scan-item">Scan ID: ${scanId}</li>`).join('') || '<li class="scan-item">No scans included</li>'}
    </ul>

    <div class="footer">
      <p>Generated by Aithon Shield - Enterprise Cybersecurity Testing Platform</p>
      <p>This report is confidential and intended for authorized personnel only.</p>
    </div>
  </div>
</body>
</html>
      `.trim();

      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', `attachment; filename="${report.name.replace(/[^a-z0-9]/gi, '_')}.html"`);
      res.send(htmlContent);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // AI Validation Service endpoint
  app.post("/api/validate-code", requireAuth, async (req: any, res) => {
    try {
      const { scanId, scanType } = req.body;
      
      if (!scanId || !scanType) {
        return res.status(400).json({ message: "scanId and scanType are required" });
      }
      
      // Get user's subscription tier (default to free)
      const user = await storage.getUser(req.user.id);
      const subscriptionTier = user?.subscriptionTier || 'free';
      
      // Run comprehensive validation
      const validationResult = await validateCodeBeforeUpload(
        storage,
        req.user.id,
        scanId,
        scanType,
        subscriptionTier as 'free' | 'pro' | 'enterprise'
      );
      
      res.json(validationResult);
    } catch (error: any) {
      console.error("Validation error:", error);
      res.status(500).json({ message: error.message || "Validation failed" });
    }
  });

  // Enhanced Fix Validation Workflow Endpoints

  // Post-fix validation - Comprehensive app scan after applying fixes
  app.post("/api/scans/:scanType/:id/validate-post-fix", requireAuth, async (req: any, res) => {
    try {
      const { scanType, id } = req.params;
      const userId = req.user!.id;
      
      // Validate scan type
      const validScanTypes = ['mvp', 'mobile', 'web'];
      if (!validScanTypes.includes(scanType)) {
        return res.status(400).json({ message: "Invalid scan type" });
      }
      
      // Get or create fix validation session
      let session = await storage.getFixValidationSessionByScan(id, userId);
      if (!session) {
        session = await storage.createFixValidationSession({
          userId,
          scanType,
          scanId: id,
          currentStep: 'post_validation',
          preFixValidationStatus: 'passed',
          postFixValidationStatus: 'running',
          postFixIssues: [] as any, // Initialize as empty array
        });
      } else {
        // Update session to post-validation step
        const updated = await storage.updateFixValidationSession(session.id, userId, {
          currentStep: 'post_validation',
          postFixValidationStatus: 'running',
          postFixIssues: [] as any, // Reset to empty array
        });
        if (!updated) {
          return res.status(500).json({ message: "Failed to update validation session" });
        }
        session = updated;
      }
      
      // Get actual findings from the scan to use as post-fix issues
      let scanFindings: any[] = [];
      try {
        scanFindings = await storage.getFindingsByScan(id, userId, scanType);
      } catch (error) {
        console.error("Error fetching scan findings:", error);
      }
      
      console.log(`[Post-Fix Validation] Found ${scanFindings.length} findings for scan ${id}`);
      
      // Convert findings to post-fix issues format
      const postFixIssues = scanFindings.map((finding: any) => ({
        type: finding.category.toLowerCase().replace(/\s+/g, '_'),
        severity: finding.severity,
        title: finding.title,
        description: finding.description || "",
        file: finding.location || "unknown",
        line: 0, // Parse from location if available
        function: null,
      }));
      
      // Simulate comprehensive post-fix validation (would be AI-powered in production)
      setTimeout(async () => {
        if (postFixIssues.length > 0) {
          await storage.updateFixValidationSession(session!.id, req.user.id, {
            postFixValidationStatus: 'failed',
            postFixIssues: postFixIssues as any,
            currentStep: 'results',
          });
        } else {
          await storage.updateFixValidationSession(session!.id, req.user.id, {
            postFixValidationStatus: 'passed',
            postFixIssues: [] as any,
            currentStep: 'completed',
            completedAt: new Date(),
          });
        }
      }, 2000); // Simulate 2 second validation process
      
      // Return the full session object so frontend can track it immediately
      res.json(session);
    } catch (error: any) {
      console.error("Post-fix validation error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get fix validation session status
  app.get("/api/fix-validation-sessions/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      const session = await storage.getFixValidationSession(req.params.id, userId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      res.json(session);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Generate manual fix code snippets (free option)
  app.post("/api/scans/:scanType/:id/manual-fix-snippets", requireAuth, async (req: any, res) => {
    try {
      const { scanType, id } = req.params;
      const userId = req.user!.id;
      
      // Get fix validation session
      const session = await storage.getFixValidationSessionByScan(id, userId);
      if (!session) {
        return res.status(404).json({ message: "Validation session not found" });
      }
      
      // Generate code snippets for manual fixes (would be AI-powered in production)
      const postFixIssues = (session.postFixIssues as any[]) || [];
      const snippets = postFixIssues.map((issue: any, index: number) => ({
        id: `snippet-${index}`,
        issueTitle: issue.title,
        file: issue.file,
        line: issue.line,
        function: issue.function,
        description: issue.description,
        code: generateFixSnippet(issue),
        language: detectLanguage(issue.file),
      }));
      
      // Store snippets in session and get the updated session
      const updatedSession = await storage.updateFixValidationSession(session.id, userId, {
        manualFixSnippets: snippets as any,
      });
      
      if (!updatedSession) {
        return res.status(500).json({ message: "Failed to update session with snippets" });
      }
      
      // Return the full updated session for frontend cache consistency
      res.json(updatedSession);
    } catch (error: any) {
      console.error("Snippet generation error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Automated fix service (paid option) - Creates payment intent and queues fix job
  app.post("/api/scans/:scanType/:id/auto-fix-all", requireAuth, async (req: any, res) => {
    try {
      const { scanType, id } = req.params;
      const userId = req.user!.id;
      
      // Get fix validation session
      const session = await storage.getFixValidationSessionByScan(id, userId);
      if (!session) {
        return res.status(404).json({ message: "Validation session not found" });
      }
      
      const postFixIssues = (session.postFixIssues as any[]) || [];
      if (postFixIssues.length === 0) {
        return res.status(400).json({ message: "No issues to fix" });
      }
      
      // Calculate pricing: $5 base + $2 per issue
      const baseFee = 500; // $5 in cents
      const perIssueFee = 200; // $2 per issue in cents
      const totalAmount = baseFee + (postFixIssues.length * perIssueFee);
      
      // Check if Stripe is configured (testing or production)
      const stripeSecretKey = process.env.TESTING_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
      if (!stripeSecretKey) {
        // Return mock response for demo without Stripe
        res.json({
          requiresPayment: true,
          amount: totalAmount,
          currency: 'usd',
          issueCount: postFixIssues.length,
          message: 'Stripe integration not configured. This would normally create a payment intent.',
          demoMode: true,
        });
        return;
      }
      
      // Create Stripe PaymentIntent (from Stripe blueprint)
      const stripe = new Stripe(stripeSecretKey, {
        apiVersion: "2023-10-16",
      });
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: totalAmount,
        currency: "usd",
        metadata: {
          sessionId: session.id,
          userId,
          scanType,
          scanId: id,
          issueCount: postFixIssues.length,
        },
      });
      
      // Update session with payment info
      await storage.updateFixValidationSession(session.id, userId, {
        stripePaymentIntentId: paymentIntent.id,
        paymentStatus: 'pending',
        automatedFixRequested: true,
      });
      
      res.json({
        clientSecret: paymentIntent.client_secret,
        amount: totalAmount,
        currency: 'usd',
        issueCount: postFixIssues.length,
      });
    } catch (error: any) {
      console.error("Auto-fix payment error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Confirm payment and start automated fix job
  app.post("/api/fix-validation-sessions/:id/confirm-payment", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      const session = await storage.getFixValidationSession(req.params.id, userId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      // Create automated fix job
      const job = await storage.createAutomatedFixJob({
        userId,
        sessionId: session.id,
        scanType: session.scanType,
        scanId: session.scanId,
        status: 'queued',
        progress: 0,
      });
      
      // Update session
      await storage.updateFixValidationSession(session.id, userId, {
        paymentStatus: 'paid',
        automatedFixJobId: job.id,
      });
      
      // Start automated fix process (simulate with timeout)
      setTimeout(async () => {
        const postFixIssues = (session.postFixIssues as any[]) || [];
        
        // Simulate fixing issues
        for (let i = 0; i < postFixIssues.length; i++) {
          await storage.updateAutomatedFixJob(job.id, userId, {
            progress: Math.round(((i + 1) / postFixIssues.length) * 100),
            currentTask: `Fixing: ${postFixIssues[i].title}`,
          });
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Mark job as completed
        await storage.updateAutomatedFixJob(job.id, userId, {
          status: 'completed',
          progress: 100,
          issuesFixed: postFixIssues.length,
          completedAt: new Date(),
        });
        
        // Update session
        await storage.updateFixValidationSession(session.id, userId, {
          currentStep: 'completed',
          completedAt: new Date(),
        });

        // Mark scan and all its findings as having fixes applied
        try {
          // Mark the scan as having fixes applied
          if (session.scanType === 'mvp') {
            await storage.updateMvpCodeScan(session.scanId, userId, { fixesApplied: true });
          } else if (session.scanType === 'mobile') {
            await storage.updateMobileAppScan(session.scanId, userId, { fixesApplied: true });
          } else if (session.scanType === 'web') {
            await storage.updateWebAppScan(session.scanId, userId, { fixesApplied: true });
          }

          // Mark all findings for this scan as resolved and having fixes applied
          await storage.markFindingsAsFixed(session.scanId, session.scanType, userId);
          
          // Run post-fix validation to check for breaking changes
          await storage.updateAutomatedFixJob(job.id, userId, {
            status: 'validating',
            currentTask: 'Running post-fix validation...',
            progress: 100,
          });
          
          // Simulate post-fix validation (in production, this would run actual tests)
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Check for any new breaking issues introduced by fixes
          const postFixValidationResult = await validateCodeBeforeUpload(
            storage,
            userId,
            session.scanId,
            session.scanType as 'mvp' | 'mobile' | 'web',
            'pro' // Assume pro tier for automated fix users
          );
          
          // Complete the fix phase, now start comprehensive testing
          await storage.updateAutomatedFixJob(job.id, userId, {
            status: 'completed',
            currentTask: `Fixes applied. Starting comprehensive tests...`,
            testStatus: 'running',
            testProgress: 0,
            testStartedAt: new Date(),
          });
          
          console.log(`[AutoFix] Starting comprehensive testing for job ${job.id}`);
          
          // Run comprehensive tests to ensure fixes don't break functionality
          const testResults = await runComprehensiveTests(
            storage,
            userId,
            session.scanId,
            session.scanType as 'mvp' | 'mobile' | 'web'
          );
          
          // Update job with test results
          const testsPassed = testResults.overallStatus === 'passed';
          await storage.updateAutomatedFixJob(job.id, userId, {
            testStatus: testsPassed ? 'passed' : 'failed',
            testProgress: 100,
            testSummary: testResults.summary,
            testDetails: {
              logs: testResults.logs,
              passedSuites: testResults.passedSuites,
              failedSuites: testResults.failedSuites,
              ...testResults.details,
            },
            testCompletedAt: new Date(),
            currentTask: testsPassed 
              ? `All tests passed! Ready for upload.`
              : `Tests failed: ${testResults.failedSuites.join(', ')}. Use manual fixes instead.`,
          });
          
          console.log(`[AutoFix] Testing completed for job ${job.id}: ${testsPassed ? 'PASSED' : 'FAILED'} - ${testResults.summary}`);
        } catch (error) {
          console.error('Error in post-fix validation:', error);
          // CRITICAL: Always mark job as completed even if validation fails
          await storage.updateAutomatedFixJob(job.id, userId, {
            status: 'completed',
            currentTask: 'Fixes applied successfully (validation encountered an error)',
          });
        }
      }, 1000);
      
      res.json({
        jobId: job.id,
        status: 'queued',
        message: 'Automated fix job started',
      });
    } catch (error: any) {
      console.error("Confirm payment error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get automated fix job status
  app.get("/api/automated-fix-jobs/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      const job = await storage.getAutomatedFixJob(req.params.id, userId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      res.json(job);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Global Fix Jobs - Fix all unresolved issues across all scans
  app.post("/api/global-fix-jobs", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;

      // Get all unresolved findings for this user that haven't had fixes applied yet
      const allFindings = await storage.getAllFindings(userId, false);
      const unresolvedFindings = allFindings.filter(f => 
        f.status !== 'resolved' && 
        f.status !== 'false-positive' && 
        f.fixesApplied === false
      );

      if (unresolvedFindings.length === 0) {
        return res.status(400).json({ message: "No unresolved issues to fix" });
      }

      // Group findings by scan type and scan ID
      const findingsByScan = new Map<string, { scanId: string; scanType: string; scanName: string; findings: typeof unresolvedFindings }>();
      
      for (const finding of unresolvedFindings) {
        const key = `${finding.scanType}-${finding.scanId}`;
        if (!findingsByScan.has(key)) {
          // Get scan name based on type
          let scanName = 'Unknown';
          try {
            if (finding.scanType === 'mvp') {
              const scan = await storage.getMvpCodeScan(finding.scanId, userId);
              scanName = scan?.projectName || 'MVP Project';
            } else if (finding.scanType === 'mobile') {
              const scan = await storage.getMobileAppScan(finding.scanId, userId);
              scanName = scan?.appName || 'Mobile App';
            } else if (finding.scanType === 'web') {
              const scan = await storage.getWebAppScan(finding.scanId, userId);
              scanName = scan?.appName || 'Web App';
            } else if (finding.scanType === 'pipeline') {
              const scan = await storage.getPipelineScan(finding.scanId, userId);
              scanName = scan?.repositoryName || 'Pipeline';
            } else if (finding.scanType === 'container') {
              const scan = await storage.getContainerScan(finding.scanId, userId);
              scanName = scan?.imageName || 'Container';
            } else if (finding.scanType === 'network') {
              const scan = await storage.getNetworkScan(finding.scanId, userId);
              // Support both old (targetIp/targetDomain) and new (targetHost/targetName) field names
              const target = (scan as any)?.targetName || (scan as any)?.targetHost || (scan as any)?.targetDomain || (scan as any)?.targetIp;
              scanName = target ? `Network - ${target}` : 'Network';
            } else if (finding.scanType === 'linter') {
              const scan = await storage.getLinterScan(finding.scanId, userId);
              scanName = scan?.projectName || 'Linter';
            }
          } catch (error) {
            console.error(`Error fetching scan name for ${finding.scanType} ${finding.scanId}:`, error);
          }

          findingsByScan.set(key, {
            scanId: finding.scanId,
            scanType: finding.scanType,
            scanName,
            findings: [],
          });
        }
        findingsByScan.get(key)!.findings.push(finding);
      }

      // Calculate pricing with tiered model: issues > 30 days old are paid, newer issues are free
      const PER_ISSUE_FEE = 200; // $2.00 per paid issue
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      // Split findings into free (< 30 days old) and paid (>= 30 days old)
      const freeFindings = unresolvedFindings.filter(f => new Date(f.createdAt) > thirtyDaysAgo);
      const paidFindings = unresolvedFindings.filter(f => new Date(f.createdAt) <= thirtyDaysAgo);
      
      const freeIssueCount = freeFindings.length;
      const paidIssueCount = paidFindings.length;
      
      // Only charge for issues older than 30 days (no base fee)
      const totalAmount = PER_ISSUE_FEE * paidIssueCount;

      // Create global fix job
      const job = await storage.createGlobalFixJob({
        userId,
        status: 'payment_pending',
        totalIssues: unresolvedFindings.length,
        totalAmount,
        paymentStatus: 'pending',
        totalScans: findingsByScan.size,
        scansCompleted: 0,
        scansFailed: 0,
      });

      // Only create payment intent if there's a charge (skip Stripe for free fixes)
      let paymentIntentId: string | null = null;
      let clientSecret: string | null = null;
      let demoMode = true;

      if (totalAmount > 0) {
        try {
          const paymentResult = await createOrReusePaymentIntent(
            job,
            totalAmount,
            userId,
            job.id
          );
          paymentIntentId = paymentResult.paymentIntentId;
          clientSecret = paymentResult.clientSecret;
          demoMode = paymentResult.demoMode;
        } catch (stripeError: any) {
          console.error("Stripe payment intent creation failed:", stripeError);
          // Fall back to demo mode if Stripe fails
          demoMode = true;
        }
      }

      await storage.updateGlobalFixJob(job.id, userId, {
        stripePaymentIntentId: paymentIntentId,
        demoMode,
      });

      // Create scan tasks
      for (const scanData of Array.from(findingsByScan.values())) {
        await storage.createGlobalFixScanTask({
          jobId: job.id,
          userId,
          scanId: scanData.scanId,
          scanType: scanData.scanType,
          scanName: scanData.scanName,
          status: 'pending',
          progress: 0,
          issueCount: scanData.findings.length,
          issuesFixed: 0,
          issuesFailed: 0,
        });
      }

      res.json({
        jobId: job.id,
        clientSecret: totalAmount > 0 ? clientSecret : null, // Only include clientSecret if payment needed
        totalAmount,
        totalIssues: unresolvedFindings.length,
        freeIssueCount,
        paidIssueCount,
        totalScans: findingsByScan.size,
        demoMode: totalAmount === 0 ? true : demoMode, // If no payment needed, treat as demo mode
        scanBreakdown: Array.from(findingsByScan.values()).map(s => ({
          scanType: s.scanType,
          scanName: s.scanName,
          issueCount: s.findings.length,
        })),
      });
    } catch (error: any) {
      console.error("Global fix job creation error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Confirm payment and start global fix job
  app.post("/api/global-fix-jobs/:id/confirm-payment", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const job = await storage.getGlobalFixJob(req.params.id, userId);

      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      if (job.status !== 'payment_pending') {
        return res.status(400).json({ message: "Job is not awaiting payment" });
      }

      const { demoMode } = req.body;

      // In demo mode, skip actual Stripe verification
      if (!demoMode && job.stripePaymentIntentId) {
        try {
    
          const stripe = new Stripe((process.env.TESTING_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY), {
            apiVersion: "2023-10-16",
          });
          const intent = await stripe.paymentIntents.retrieve(job.stripePaymentIntentId);
          if (intent.status !== 'succeeded') {
            return res.status(400).json({ message: "Payment not confirmed" });
          }
        } catch (error: any) {
          console.error("Stripe verification error:", error);
          return res.status(400).json({ message: "Payment verification failed" });
        }
      }

      // Update job status
      await storage.updateGlobalFixJob(job.id, userId, {
        paymentStatus: 'paid',
        status: 'processing',
        paymentConfirmedAt: new Date(),
      });

      // Start processing scans sequentially
      processGlobalFixJob(job.id, userId);

      res.json({
        jobId: job.id,
        status: 'processing',
        message: 'Payment confirmed, processing fixes across all scans',
      });
    } catch (error: any) {
      console.error("Global fix job payment confirmation error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get global fix job status
  app.get("/api/global-fix-jobs/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const job = await storage.getGlobalFixJob(req.params.id, userId);

      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      res.json(job);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get global fix job scan tasks
  app.get("/api/global-fix-jobs/:id/tasks", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const job = await storage.getGlobalFixJob(req.params.id, userId);

      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      const tasks = await storage.getGlobalFixScanTasks(job.id, userId);
      res.json(tasks);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update upload decision for a scan task
  app.patch("/api/global-fix-jobs/:jobId/tasks/:taskId/upload-decision", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { jobId, taskId } = req.params;
      const { uploadDecision } = req.body;

      if (!['yes', 'no', 'with_tests'].includes(uploadDecision)) {
        return res.status(400).json({ message: "Invalid upload decision" });
      }

      const task = await storage.getGlobalFixScanTask(taskId, userId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      if (task.jobId !== jobId) {
        return res.status(400).json({ message: "Task does not belong to this job" });
      }

      // Handle different upload decisions
      if (uploadDecision === 'with_tests') {
        // For 'with_tests', run tests first before enabling upload
        const updatedTask = await storage.updateGlobalFixScanTask(taskId, userId, {
          uploadDecision,
          uploadStatus: 'pending',
          testStatus: 'running',
          readyForUpload: false,
        });

        // Simulate running tests
        setTimeout(async () => {
          // Tests complete successfully
          await storage.updateGlobalFixScanTask(taskId, userId, {
            testStatus: 'passed',
            testCompletedAt: new Date(),
            readyForUpload: true, // Now user can click "Upload Now"
          });

          // Create notification that tests passed and upload is ready
          await storage.createNotification({
            userId,
            type: 'fixes_applied',
            title: 'Tests Passed',
            message: `Tests completed for "${task.scanName}". Ready to upload.`,
            read: false,
          });
        }, 3000); // Simulate 3 seconds of test running

        res.json(updatedTask);
      } else if (uploadDecision === 'yes') {
        // For 'yes', upload immediately
        const updatedTask = await storage.updateGlobalFixScanTask(taskId, userId, {
          uploadDecision,
          uploadStatus: 'pending',
          testStatus: 'none',
          readyForUpload: false,
        });

        // Simulate upload process
        setTimeout(async () => {
          await storage.updateGlobalFixScanTask(taskId, userId, {
            uploadStatus: 'uploading',
          });

          // Also update the actual scan's uploadStatus
          if (task.scanType === 'mobile') {
            await storage.updateMobileAppScan(task.scanId, userId, { uploadStatus: 'pending', uploadProgress: 'uploading' });
          } else if (task.scanType === 'mvp') {
            await storage.updateMvpCodeScan(task.scanId, userId, { uploadStatus: 'pending', uploadProgress: 'uploading' });
          } else if (task.scanType === 'web') {
            await storage.updateWebAppScan(task.scanId, userId, { uploadStatus: 'pending', uploadProgress: 'uploading' });
          }

          setTimeout(async () => {
            await storage.updateGlobalFixScanTask(taskId, userId, {
              uploadStatus: 'completed',
            });

            // Also update the actual scan's uploadStatus to 'uploaded'
            if (task.scanType === 'mobile') {
              await storage.updateMobileAppScan(task.scanId, userId, { uploadStatus: 'uploaded', uploadProgress: 'idle', uploadedAt: new Date() });
            } else if (task.scanType === 'mvp') {
              await storage.updateMvpCodeScan(task.scanId, userId, { uploadStatus: 'uploaded', uploadProgress: 'idle', uploadedAt: new Date() });
            } else if (task.scanType === 'web') {
              await storage.updateWebAppScan(task.scanId, userId, { uploadStatus: 'uploaded', uploadProgress: 'idle', uploadedAt: new Date() });
            }

            // Send upload completion notification
            await notifyUploadComplete(storage, userId, task.scanId, task.scanType, task.scanName);
          }, 2000);
        }, 1000);

        res.json(updatedTask);
      } else {
        // For 'no', skip upload
        const updatedTask = await storage.updateGlobalFixScanTask(taskId, userId, {
          uploadDecision,
          uploadStatus: 'skipped',
          testStatus: 'none',
          readyForUpload: false,
        });

        res.json(updatedTask);
      }
    } catch (error: any) {
      console.error("Upload decision update error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Trigger upload after tests complete (for 'with_tests' workflow)
  app.post("/api/global-fix-jobs/:jobId/tasks/:taskId/upload", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { jobId, taskId } = req.params;

      const task = await storage.getGlobalFixScanTask(taskId, userId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      if (task.jobId !== jobId) {
        return res.status(400).json({ message: "Task does not belong to this job" });
      }

      // Verify this task is ready for upload (tests passed)
      if (!task.readyForUpload) {
        return res.status(400).json({ message: "Task is not ready for upload. Tests must pass first." });
      }

      if (task.testStatus !== 'passed') {
        return res.status(400).json({ message: "Tests have not passed yet." });
      }

      // Start the upload process
      await storage.updateGlobalFixScanTask(taskId, userId, {
        uploadStatus: 'uploading',
        readyForUpload: false, // Clear the ready flag since we're now uploading
      });

      // Also update the actual scan's uploadStatus
      if (task.scanType === 'mobile') {
        await storage.updateMobileAppScan(task.scanId, userId, { uploadStatus: 'pending', uploadProgress: 'uploading' });
      } else if (task.scanType === 'mvp') {
        await storage.updateMvpCodeScan(task.scanId, userId, { uploadStatus: 'pending', uploadProgress: 'uploading' });
      } else if (task.scanType === 'web') {
        await storage.updateWebAppScan(task.scanId, userId, { uploadStatus: 'pending', uploadProgress: 'uploading' });
      }

      // Simulate upload process
      setTimeout(async () => {
        await storage.updateGlobalFixScanTask(taskId, userId, {
          uploadStatus: 'completed',
        });

        // Also update the actual scan's uploadStatus to 'uploaded'
        if (task.scanType === 'mobile') {
          await storage.updateMobileAppScan(task.scanId, userId, { uploadStatus: 'uploaded', uploadProgress: 'idle', uploadedAt: new Date() });
        } else if (task.scanType === 'mvp') {
          await storage.updateMvpCodeScan(task.scanId, userId, { uploadStatus: 'uploaded', uploadProgress: 'idle', uploadedAt: new Date() });
        } else if (task.scanType === 'web') {
          await storage.updateWebAppScan(task.scanId, userId, { uploadStatus: 'uploaded', uploadProgress: 'idle', uploadedAt: new Date() });
        }

        // Send upload completion notification
        await notifyUploadComplete(storage, userId, task.scanId, task.scanType, task.scanName);
      }, 2000);

      res.json({ message: "Upload started", taskId });
    } catch (error: any) {
      console.error("Upload trigger error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Pipeline Scan routes
  app.get("/api/pipeline-scans", requireAuth, async (req: any, res) => {
    try {
      const scans = await storage.getAllPipelineScans(req.user.id);
      res.json(scans);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/pipeline-scans/:id", requireAuth, async (req: any, res) => {
    try {
      const scan = await storage.getPipelineScan(req.params.id, req.user.id);
      if (!scan || scan.userId !== req.user.id) {
        return res.status(404).json({ message: "Pipeline scan not found" });
      }
      res.json(scan);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/pipeline-scans", requireAuth, async (req, res) => {
    try {
      const validatedData = insertPipelineScanSchema.omit({ userId: true }).parse(req.body);
      const scan = await storage.createPipelineScan({
        ...validatedData,
        userId: req.user.id,
      });
      
      // Auto-complete scan after simulated pipeline analysis (3.5 seconds)
      setTimeout(async () => {
        const mockFindings = Math.floor(Math.random() * 18) + 8;
        const critical = Math.floor(Math.random() * 4);
        const high = Math.floor(Math.random() * 6);
        const medium = Math.floor(Math.random() * 7);
        const low = mockFindings - critical - high - medium;

        // Create findings for pipeline scan
        const mockFindingTemplates = [
          { title: "Hardcoded Secrets in Pipeline", category: "Secrets Management", cwe: "798", severity: "CRITICAL" },
          { title: "Insecure Pipeline Configuration", category: "Configuration", cwe: "16", severity: "CRITICAL" },
          { title: "Missing Code Quality Gates", category: "Code Quality", cwe: "1004", severity: "HIGH" },
          { title: "Insufficient Test Coverage", category: "Testing", cwe: "1126", severity: "HIGH" },
          { title: "Weak Access Controls", category: "Access Control", cwe: "284", severity: "MEDIUM" },
          { title: "Missing Security Scans", category: "Security", cwe: "1127", severity: "MEDIUM" },
          { title: "Outdated Dependencies", category: "Dependencies", cwe: "1104", severity: "LOW" },
        ];

        let createdCount = 0;
        for (let i = 0; i < critical && createdCount < mockFindings; i++) {
          const template = mockFindingTemplates[createdCount % mockFindingTemplates.length];
          await storage.createFinding({
            userId: scan.userId,
            title: template.title,
            description: `Critical CI/CD pipeline security issue detected that requires immediate attention.`,
            severity: "CRITICAL",
            category: template.category,
            asset: "CI/CD Pipeline",
            cwe: template.cwe,
            detected: new Date().toISOString(),
            status: "open",
            location: `${scan.repositoryName}/config:${Math.floor(Math.random() * 50) + 1}`,
            remediation: `Review and update pipeline configuration to address this critical security issue.`,
            aiSuggestion: `AI suggests: Implement proper secrets management and security scanning in your CI/CD pipeline.`,
            riskScore: Math.floor(Math.random() * 20) + 80,
            source: "pipeline-scan",
            pipelineScanId: scan.id,
            scanId: scan.id,
            scanType: "pipeline",
          });
          createdCount++;
        }
        for (let i = 0; i < high && createdCount < mockFindings; i++) {
          const template = mockFindingTemplates[createdCount % mockFindingTemplates.length];
          await storage.createFinding({
            userId: scan.userId,
            title: template.title,
            description: `High priority CI/CD pipeline issue that should be addressed soon.`,
            severity: "HIGH",
            category: template.category,
            asset: "CI/CD Pipeline",
            cwe: template.cwe,
            detected: new Date().toISOString(),
            status: "open",
            location: `${scan.repositoryName}/stage-${Math.floor(Math.random() * 5) + 1}`,
            remediation: `Improve pipeline security and quality controls.`,
            aiSuggestion: `AI suggests: Add comprehensive testing and security gates to your deployment pipeline.`,
            riskScore: Math.floor(Math.random() * 20) + 60,
            source: "pipeline-scan",
            pipelineScanId: scan.id,
            scanId: scan.id,
            scanType: "pipeline",
          });
          createdCount++;
        }
        for (let i = 0; i < medium && createdCount < mockFindings; i++) {
          const template = mockFindingTemplates[createdCount % mockFindingTemplates.length];
          await storage.createFinding({
            userId: scan.userId,
            title: template.title,
            description: `Medium priority CI/CD pipeline issue.`,
            severity: "MEDIUM",
            category: template.category,
            asset: "CI/CD Pipeline",
            cwe: template.cwe,
            detected: new Date().toISOString(),
            status: "open",
            location: `${scan.repositoryName}/job-${Math.floor(Math.random() * 10) + 1}`,
            remediation: `Review and improve pipeline configuration.`,
            aiSuggestion: `AI suggests: Follow CI/CD security best practices.`,
            riskScore: Math.floor(Math.random() * 20) + 40,
            source: "pipeline-scan",
            pipelineScanId: scan.id,
            scanId: scan.id,
            scanType: "pipeline",
          });
          createdCount++;
        }
        for (let i = 0; i < low && createdCount < mockFindings; i++) {
          const template = mockFindingTemplates[createdCount % mockFindingTemplates.length];
          await storage.createFinding({
            userId: scan.userId,
            title: template.title,
            description: `Low priority CI/CD pipeline issue.`,
            severity: "LOW",
            category: template.category,
            asset: "CI/CD Pipeline",
            cwe: template.cwe,
            detected: new Date().toISOString(),
            status: "open",
            location: `${scan.repositoryName}/notification`,
            remediation: `Consider improving pipeline monitoring and reporting.`,
            aiSuggestion: `AI suggests: Implement comprehensive logging for pipeline events.`,
            riskScore: Math.floor(Math.random() * 20) + 10,
            source: "pipeline-scan",
            pipelineScanId: scan.id,
            scanId: scan.id,
            scanType: "pipeline",
          });
          createdCount++;
        }

        await storage.updatePipelineScan(scan.id, scan.userId, {
          scanStatus: 'completed',
          scannedAt: new Date(),
          findingsCount: mockFindings,
          criticalCount: critical,
          highCount: high,
          mediumCount: medium,
          lowCount: low,
        });

        // Send push notification for scan completion
        await notifyScanComplete(
          storage,
          scan.userId,
          scan.id,
          'ci-cd',
          'Pipeline Scan',
          mockFindings
        );
      }, 3500);

      res.status(201).json(scan);
    } catch (error: any) {
      if (error instanceof ZodError) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  app.patch("/api/pipeline-scans/:id", requireAuth, async (req: any, res) => {
    try {
      const validatedData = updatePipelineScanSchema.parse(req.body);
      const scan = await storage.updatePipelineScan(req.params.id, req.user.id, validatedData);
      if (!scan) {
        return res.status(404).json({ message: "Pipeline scan not found" });
      }
      res.json(scan);
    } catch (error: any) {
      if (error instanceof ZodError) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  // Container Scan routes
  
  // Register container fix workflow routes using factory
  registerFixWorkflowRoutes(app, requireAuth, {
    scanType: 'container',
    routePrefix: 'container',
    scanIdField: 'containerScanId',
    getScan: (id, userId) => storage.getContainerScan(id, userId),
    updateScan: (id, userId, updates) => storage.updateContainerScan(id, userId, updates),
    getBatchByScan: (scanId, userId) => storage.getContainerFixBatchByScan(scanId, userId),
    createBatch: (batch) => storage.createContainerFixBatch(batch),
    getBatch: (id, userId) => storage.getContainerFixBatch(id, userId),
    updateBatch: (id, userId, updates) => storage.updateContainerFixBatch(id, userId, updates),
  });
  
  app.get("/api/container-scans", requireAuth, async (req: any, res) => {
    try {
      const scans = await storage.getAllContainerScans(req.user.id);
      res.json(scans);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/container-scans/:id", requireAuth, async (req: any, res) => {
    try {
      const scan = await storage.getContainerScan(req.params.id, req.user.id);
      if (!scan || scan.userId !== req.user.id) {
        return res.status(404).json({ message: "Container scan not found" });
      }
      res.json(scan);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/container-scans", requireAuth, async (req, res) => {
    try {
      const validatedData = insertContainerScanSchema.omit({ userId: true }).parse(req.body);
      const scan = await storage.createContainerScan({
        ...validatedData,
        userId: req.user.id,
      });
      
      // Auto-complete scan after simulated multi-step process (6 seconds total)
      setTimeout(async () => {
        const mockFindings = Math.floor(Math.random() * 15) + 5;
        const critical = Math.floor(Math.random() * 4);
        const high = Math.floor(Math.random() * 6);
        const medium = Math.floor(Math.random() * 8);
        const low = mockFindings - critical - high - medium;

        // Create findings for container scan
        const mockFindingTemplates = [
          { title: "Vulnerable Base Image", category: "Container Security", cwe: "1395", severity: "CRITICAL" },
          { title: "Exposed Secrets in Layers", category: "Secrets Management", cwe: "798", severity: "CRITICAL" },
          { title: "Excessive Container Privileges", category: "Access Control", cwe: "250", severity: "HIGH" },
          { title: "Missing Security Scanning", category: "Security", cwe: "1127", severity: "HIGH" },
          { title: "Outdated Container Dependencies", category: "Dependencies", cwe: "1104", severity: "MEDIUM" },
          { title: "Improper Layer Caching", category: "Configuration", cwe: "16", severity: "MEDIUM" },
          { title: "Missing Container Labels", category: "Configuration", cwe: "1188", severity: "LOW" },
        ];

        let createdCount = 0;
        for (let i = 0; i < critical && createdCount < mockFindings; i++) {
          const template = mockFindingTemplates[createdCount % mockFindingTemplates.length];
          await storage.createFinding({
            userId: scan.userId,
            title: template.title,
            description: `Critical container security issue detected that requires immediate attention.`,
            severity: "CRITICAL",
            category: template.category,
            asset: `${scan.imageName}:${scan.imageTag}`,
            cwe: template.cwe,
            detected: new Date().toISOString(),
            status: "open",
            location: `Layer ${Math.floor(Math.random() * 10) + 1}`,
            remediation: `Update base image and rebuild container to address this critical security issue.`,
            aiSuggestion: `AI suggests: Use minimal base images and implement proper secrets management in your containers.`,
            riskScore: Math.floor(Math.random() * 20) + 80,
            source: "container-scan",
            containerScanId: scan.id,
            scanId: scan.id,
            scanType: "container",
          });
          createdCount++;
        }
        for (let i = 0; i < high && createdCount < mockFindings; i++) {
          const template = mockFindingTemplates[createdCount % mockFindingTemplates.length];
          await storage.createFinding({
            userId: scan.userId,
            title: template.title,
            description: `High priority container security issue that should be addressed soon.`,
            severity: "HIGH",
            category: template.category,
            asset: `${scan.imageName}:${scan.imageTag}`,
            cwe: template.cwe,
            detected: new Date().toISOString(),
            status: "open",
            location: `Layer ${Math.floor(Math.random() * 10) + 1}`,
            remediation: `Review and update container configuration to improve security.`,
            aiSuggestion: `AI suggests: Follow container security best practices and minimize attack surface.`,
            riskScore: Math.floor(Math.random() * 20) + 60,
            source: "container-scan",
            containerScanId: scan.id,
            scanId: scan.id,
            scanType: "container",
          });
          createdCount++;
        }
        for (let i = 0; i < medium && createdCount < mockFindings; i++) {
          const template = mockFindingTemplates[createdCount % mockFindingTemplates.length];
          await storage.createFinding({
            userId: scan.userId,
            title: template.title,
            description: `Medium priority container security issue.`,
            severity: "MEDIUM",
            category: template.category,
            asset: `${scan.imageName}:${scan.imageTag}`,
            cwe: template.cwe,
            detected: new Date().toISOString(),
            status: "open",
            location: `Layer ${Math.floor(Math.random() * 10) + 1}`,
            remediation: `Review and improve container configuration.`,
            aiSuggestion: `AI suggests: Implement container security scanning in your CI/CD pipeline.`,
            riskScore: Math.floor(Math.random() * 20) + 40,
            source: "container-scan",
            containerScanId: scan.id,
            scanId: scan.id,
            scanType: "container",
          });
          createdCount++;
        }
        for (let i = 0; i < low && createdCount < mockFindings; i++) {
          const template = mockFindingTemplates[createdCount % mockFindingTemplates.length];
          await storage.createFinding({
            userId: scan.userId,
            title: template.title,
            description: `Low priority container security issue.`,
            severity: "LOW",
            category: template.category,
            asset: `${scan.imageName}:${scan.imageTag}`,
            cwe: template.cwe,
            detected: new Date().toISOString(),
            status: "open",
            location: `Layer ${Math.floor(Math.random() * 10) + 1}`,
            remediation: `Consider improving container metadata and documentation.`,
            aiSuggestion: `AI suggests: Add proper labels and documentation to your containers.`,
            riskScore: Math.floor(Math.random() * 20) + 10,
            source: "container-scan",
            containerScanId: scan.id,
            scanId: scan.id,
            scanType: "container",
          });
          createdCount++;
        }

        await storage.updateContainerScan(scan.id, scan.userId, {
          scanStatus: 'completed',
          scannedAt: new Date(),
          findingsCount: mockFindings,
          criticalCount: critical,
          highCount: high,
          mediumCount: medium,
          lowCount: low,
        });

        // Send push notification for scan completion
        await notifyScanComplete(
          storage,
          scan.userId,
          scan.id,
          'container',
          'Container Scan',
          mockFindings
        );
      }, 6000);

      res.status(201).json(scan);
    } catch (error: any) {
      if (error instanceof ZodError) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  app.patch("/api/container-scans/:id", requireAuth, async (req: any, res) => {
    try {
      const validatedData = insertContainerScanSchema.partial().parse(req.body);
      const scan = await storage.updateContainerScan(req.params.id, req.user.id, validatedData);
      if (!scan) {
        return res.status(404).json({ message: "Container scan not found" });
      }
      res.json(scan);
    } catch (error: any) {
      if (error instanceof ZodError) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  // Network Scan routes
  
  // Register network fix workflow routes using factory
  registerFixWorkflowRoutes(app, requireAuth, {
    scanType: 'network',
    routePrefix: 'network',
    scanIdField: 'networkScanId',
    getScan: (id, userId) => storage.getNetworkScan(id, userId),
    updateScan: (id, userId, updates) => storage.updateNetworkScan(id, userId, updates),
    getBatchByScan: (scanId, userId) => storage.getNetworkFixBatchByScan(scanId, userId),
    createBatch: (batch) => storage.createNetworkFixBatch(batch),
    getBatch: (id, userId) => storage.getNetworkFixBatch(id, userId),
    updateBatch: (id, userId, updates) => storage.updateNetworkFixBatch(id, userId, updates),
  });
  
  app.get("/api/network-scans", requireAuth, async (req: any, res) => {
    try {
      const scans = await storage.getAllNetworkScans(req.user.id);
      res.json(scans);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/network-scans/:id", requireAuth, async (req: any, res) => {
    try {
      const scan = await storage.getNetworkScan(req.params.id, req.user.id);
      if (!scan || scan.userId !== req.user.id) {
        return res.status(404).json({ message: "Network scan not found" });
      }
      res.json(scan);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/network-scans", requireAuth, async (req, res) => {
    try {
      const validatedData = insertNetworkScanSchema.omit({ userId: true }).parse(req.body);
      const scan = await storage.createNetworkScan({
        ...validatedData,
        userId: req.user.id,
      });
      
      // Auto-complete scan after simulated network analysis (5 seconds)
      setTimeout(async () => {
        const mockPorts = Math.floor(Math.random() * 15) + 5;
        const openPorts = Math.floor(mockPorts * 0.6);
        const vulnerabilities = Math.floor(Math.random() * 10) + 3;
        const critical = Math.floor(Math.random() * 2);
        const high = Math.floor(Math.random() * 4);
        const medium = vulnerabilities - critical - high;

        // Create findings for network scan
        const mockFindingTemplates = [
          { title: "Open Critical Port", category: "Network Security", cwe: "284", severity: "CRITICAL" },
          { title: "Vulnerable Service Detected", category: "Vulnerabilities", cwe: "1035", severity: "CRITICAL" },
          { title: "Weak SSL/TLS Configuration", category: "Cryptography", cwe: "326", severity: "HIGH" },
          { title: "Missing Firewall Rules", category: "Network Security", cwe: "693", severity: "HIGH" },
          { title: "Outdated Service Version", category: "Configuration", cwe: "1104", severity: "MEDIUM" },
          { title: "Unnecessary Open Port", category: "Attack Surface", cwe: "1188", severity: "MEDIUM" },
        ];

        let createdCount = 0;
        for (let i = 0; i < critical && createdCount < vulnerabilities; i++) {
          const template = mockFindingTemplates[createdCount % mockFindingTemplates.length];
          const portNumber = Math.floor(Math.random() * 9000) + 1000;
          await storage.createFinding({
            userId: scan.userId,
            title: template.title,
            description: `Critical network security issue detected that requires immediate attention.`,
            severity: "CRITICAL",
            category: template.category,
            asset: `${scan.targetHost}:${portNumber}`,
            cwe: template.cwe,
            detected: new Date().toISOString(),
            status: "open",
            location: `Port ${portNumber}`,
            remediation: `Close unnecessary ports and update vulnerable services immediately.`,
            aiSuggestion: `AI suggests: Implement network segmentation and restrict access to critical services.`,
            riskScore: Math.floor(Math.random() * 20) + 80,
            source: "network-scan",
            networkScanId: scan.id,
            scanId: scan.id,
            scanType: "network",
          });
          createdCount++;
        }
        for (let i = 0; i < high && createdCount < vulnerabilities; i++) {
          const template = mockFindingTemplates[createdCount % mockFindingTemplates.length];
          const portNumber = Math.floor(Math.random() * 9000) + 1000;
          await storage.createFinding({
            userId: scan.userId,
            title: template.title,
            description: `High priority network security issue that should be addressed soon.`,
            severity: "HIGH",
            category: template.category,
            asset: `${scan.targetHost}:${portNumber}`,
            cwe: template.cwe,
            detected: new Date().toISOString(),
            status: "open",
            location: `Port ${portNumber}`,
            remediation: `Review and update network configuration to improve security.`,
            aiSuggestion: `AI suggests: Enable strong encryption protocols and keep services updated.`,
            riskScore: Math.floor(Math.random() * 20) + 60,
            source: "network-scan",
            networkScanId: scan.id,
            scanId: scan.id,
            scanType: "network",
          });
          createdCount++;
        }
        for (let i = 0; i < medium && createdCount < vulnerabilities; i++) {
          const template = mockFindingTemplates[createdCount % mockFindingTemplates.length];
          const portNumber = Math.floor(Math.random() * 9000) + 1000;
          await storage.createFinding({
            userId: scan.userId,
            title: template.title,
            description: `Medium priority network security issue.`,
            severity: "MEDIUM",
            category: template.category,
            asset: `${scan.targetHost}:${portNumber}`,
            cwe: template.cwe,
            detected: new Date().toISOString(),
            status: "open",
            location: `Port ${portNumber}`,
            remediation: `Review and improve network security configuration.`,
            aiSuggestion: `AI suggests: Follow network security best practices and minimize exposed services.`,
            riskScore: Math.floor(Math.random() * 20) + 40,
            source: "network-scan",
            networkScanId: scan.id,
            scanId: scan.id,
            scanType: "network",
          });
          createdCount++;
        }

        await storage.updateNetworkScan(scan.id, scan.userId, {
          scanStatus: 'completed',
          scannedAt: new Date(),
          openPortsCount: openPorts,
          vulnerableServicesCount: vulnerabilities,
          findingsCount: vulnerabilities,
          criticalCount: critical,
          highCount: high,
          mediumCount: medium,
        });

        // Send push notification for scan completion
        await notifyScanComplete(
          storage,
          scan.userId,
          scan.id,
          'network',
          'Network Scan',
          vulnerabilities
        );
      }, 5000);

      res.status(201).json(scan);
    } catch (error: any) {
      if (error instanceof ZodError) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  app.patch("/api/network-scans/:id", requireAuth, async (req: any, res) => {
    try {
      const validatedData = insertNetworkScanSchema.partial().parse(req.body);
      const scan = await storage.updateNetworkScan(req.params.id, req.user.id, validatedData);
      if (!scan) {
        return res.status(404).json({ message: "Network scan not found" });
      }
      res.json(scan);
    } catch (error: any) {
      if (error instanceof ZodError) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  // Linter Scan routes
  app.get("/api/linter-scans", requireAuth, async (req: any, res) => {
    try {
      const scans = await storage.getAllLinterScans(req.user.id);
      res.json(scans);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/linter-scans/:id", requireAuth, async (req: any, res) => {
    try {
      const scan = await storage.getLinterScan(req.params.id, req.user.id);
      if (!scan || scan.userId !== req.user.id) {
        return res.status(404).json({ message: "Linter scan not found" });
      }
      res.json(scan);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/linter-scans", requireAuth, async (req, res) => {
    try {
      const validatedData = insertLinterScanSchema.omit({ userId: true }).parse(req.body);
      const scan = await storage.createLinterScan({
        ...validatedData,
        userId: req.user.id,
      });
      
      // Auto-complete scan after simulated analysis (4 seconds)
      setTimeout(async () => {
        const mockIssues = Math.floor(Math.random() * 20) + 10;
        const hygieneIssues = Math.floor(Math.random() * 8) + 2;
        const bestPracticeIssues = Math.floor(Math.random() * 8) + 2;
        const securityIssues = mockIssues - hygieneIssues - bestPracticeIssues;

        // Create findings for linter scan — rich templates spanning all categories + overlaps
        const srcBase = scan.projectName || 'src';
        const files = [
          `${srcBase}/api/userController.ts`,
          `${srcBase}/services/authService.ts`,
          `${srcBase}/utils/helpers.ts`,
          `${srcBase}/models/database.ts`,
          `${srcBase}/middleware/validation.ts`,
          `${srcBase}/routes/payments.ts`,
          `${srcBase}/config/settings.ts`,
          `${srcBase}/components/SearchInput.tsx`,
        ];
        const randLine = () => Math.floor(Math.random() * 120) + 5;
        const randFile = () => files[Math.floor(Math.random() * files.length)];

        // ── Security-only findings (Code Security, no overlap) ──
        const securityOnlyTemplates = [
          {
            title: "Broken Access Control",
            description: "Endpoint does not verify the authenticated user has permission to access the requested resource. A low-privileged attacker could read or modify data belonging to other users.",
            cwe: "284", severity: "CRITICAL",
            remediation: "Add role-based access control checks on every sensitive endpoint. Verify resource ownership before returning data.",
            aiSuggestion: `// Bad: no ownership check\nconst record = await db.find(req.params.id);\n\n// Good: verify ownership\nconst record = await db.find(req.params.id);\nif (record.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });`,
          },
          {
            title: "Insufficient Session Expiry",
            description: "User sessions do not expire after a reasonable period of inactivity. A stolen session token remains valid indefinitely, granting permanent access to an attacker.",
            cwe: "613", severity: "HIGH",
            remediation: "Set session maxAge to 15–30 minutes for sensitive applications. Implement sliding expiry reset on activity.",
            aiSuggestion: `// Bad\napp.use(session({ secret: process.env.SESSION_SECRET }));\n\n// Good\napp.use(session({\n  secret: process.env.SESSION_SECRET,\n  cookie: { maxAge: 30 * 60 * 1000 }, // 30 min\n  rolling: true,\n}));`,
          },
          {
            title: "Missing CSRF Protection",
            description: "State-changing API endpoints accept requests without CSRF token validation. An attacker can trick authenticated users into unknowingly executing actions on their behalf.",
            cwe: "352", severity: "HIGH",
            remediation: "Use the csurf middleware or SameSite cookie attribute. Validate the Origin/Referer header for all non-GET requests.",
            aiSuggestion: `import csrf from 'csurf';\nconst csrfProtection = csrf({ cookie: true });\n\n// Apply to all mutating routes\napp.post('/api/settings', csrfProtection, settingsHandler);`,
          },
          {
            title: "Security Headers Missing",
            description: "HTTP response headers such as Content-Security-Policy, X-Frame-Options, and Strict-Transport-Security are absent. Browsers cannot apply protection against clickjacking or content injection.",
            cwe: "693", severity: "MEDIUM",
            remediation: "Add the helmet middleware (Node.js) or equivalent. At minimum set CSP, X-Frame-Options: DENY, and HSTS.",
            aiSuggestion: `import helmet from 'helmet';\napp.use(helmet()); // Adds all recommended security headers`,
          },
        ];

        // ── Overlap findings (Code Security but also a coding mistake) ──
        const overlapSecurityTemplates = [
          {
            title: "SQL Injection via String Concatenation",
            description: "User-supplied input is concatenated directly into a SQL query string. This is simultaneously a coding mistake (string building instead of parameterisation) and a critical security vulnerability that allows attackers to read, modify, or delete arbitrary database records.",
            cwe: "89", severity: "CRITICAL",
            remediation: "Always use parameterised queries or an ORM's built-in escaping. Never concatenate user input into SQL strings.",
            aiSuggestion: `// Bad (code mistake + security risk)\nconst query = "SELECT * FROM users WHERE id = " + req.params.id;\n\n// Good (parameterised)\nconst query = "SELECT * FROM users WHERE id = $1";\nconst result = await pool.query(query, [req.params.id]);`,
          },
          {
            title: "Hardcoded API Credential",
            description: "An API key or password is hardcoded directly in source code. This is both a bad coding practice (credentials should come from environment variables) and a security vulnerability that exposes secrets to anyone with repository access.",
            cwe: "798", severity: "CRITICAL",
            remediation: "Move all credentials to environment variables. Use a secrets manager (Vault, AWS Secrets Manager) in production. Rotate the exposed credential immediately.",
            aiSuggestion: `// Bad (hardcoded = code mistake + security risk)\nconst apiKey = "sk-prod-abc123xyz";\n\n// Good (from environment)\nconst apiKey = process.env.API_KEY;\nif (!apiKey) throw new Error("API_KEY environment variable is required");`,
          },
          {
            title: "Dangerous eval() Usage",
            description: "eval() is called with data that may originate from user input or external sources. Using eval() is a coding anti-pattern (there is always a safer alternative) and also creates a remote code execution vulnerability.",
            cwe: "95", severity: "CRITICAL",
            remediation: "Replace eval() with JSON.parse() for JSON data, new Function() for controlled expressions, or restructure the logic to avoid dynamic code execution entirely.",
            aiSuggestion: `// Bad (anti-pattern + security risk)\nconst result = eval(userInput);\n\n// Good (safe alternative)\nconst result = JSON.parse(userInput); // for JSON\n// or use a safe math library for expressions`,
          },
          {
            title: "XSS via innerHTML Assignment",
            description: "Untrusted data is assigned to element.innerHTML or document.write(). Using innerHTML with user data is both a code quality issue (textContent should be preferred) and allows attackers to inject malicious scripts into the page.",
            cwe: "79", severity: "HIGH",
            remediation: "Use textContent or innerText for plain text. If HTML rendering is required, sanitise with DOMPurify before assigning to innerHTML.",
            aiSuggestion: `// Bad (anti-pattern + XSS risk)\nelement.innerHTML = userInput;\n\n// Good (text only)\nelement.textContent = userInput;\n\n// Good (if HTML required)\nimport DOMPurify from 'dompurify';\nelement.innerHTML = DOMPurify.sanitize(userInput);`,
          },
          {
            title: "Sensitive Data in Logs",
            description: "Passwords, tokens, or personal data are written to log output via console.log or a logger. Logging sensitive fields is a code hygiene mistake and a security vulnerability — logs are often stored plaintext and accessible to operations staff.",
            cwe: "532", severity: "HIGH",
            remediation: "Strip sensitive fields before logging. Use a structured logger with redaction rules for fields like password, token, authorization, ssn.",
            aiSuggestion: `// Bad (code mistake + security risk)\nconsole.log('User login:', { username, password, token });\n\n// Good (redacted)\nconsole.log('User login:', { username, token: '[REDACTED]' });`,
          },
        ];

        // ── Code hygiene findings (Code Hygiene, pure code errors) ──
        const hygieneTemplates = [
          {
            title: "Unused Variable Declaration",
            description: "A variable is declared but never read or referenced in the function. Dead variable declarations increase cognitive load, waste memory, and indicate incomplete refactoring.",
            cwe: "563", severity: "LOW",
            remediation: "Remove the unused variable. If it will be needed later, leave a TODO comment instead of an empty declaration.",
            aiSuggestion: `// Bad\nconst unusedResult = computeValue();\nreturn otherValue;\n\n// Good\nreturn otherValue;`,
          },
          {
            title: "Empty Catch Block",
            description: "A try/catch block silently swallows exceptions without any logging, re-throw, or error handling. This hides runtime errors from monitoring, makes debugging very hard, and can mask security-relevant failures.",
            cwe: "391", severity: "MEDIUM",
            remediation: "Always log the caught error or take a recovery action. If suppression is intentional, add a comment explaining why.",
            aiSuggestion: `// Bad\ntry {\n  await riskyOperation();\n} catch (e) {}\n\n// Good\ntry {\n  await riskyOperation();\n} catch (e) {\n  logger.error('Operation failed:', e);\n  throw e; // re-throw or handle\n}`,
          },
          {
            title: "Magic Number Without Named Constant",
            description: "A numeric literal is used inline without being assigned to a named constant. Magic numbers reduce readability and make future changes error-prone because the same value may be duplicated across the codebase.",
            cwe: "1070", severity: "LOW",
            remediation: "Extract the value into a named constant at the top of the module or a shared constants file.",
            aiSuggestion: `// Bad\nif (items.length > 100) { ... }\nsetTimeout(refresh, 86400000);\n\n// Good\nconst MAX_ITEMS = 100;\nconst ONE_DAY_MS = 24 * 60 * 60 * 1000;\nif (items.length > MAX_ITEMS) { ... }\nsetTimeout(refresh, ONE_DAY_MS);`,
          },
          {
            title: "Inconsistent Naming Convention",
            description: "Variables or functions mix camelCase, snake_case, and PascalCase in the same scope. Inconsistent naming slows code review, increases typo risk, and makes tooling (autocomplete, grep) less reliable.",
            cwe: "1099", severity: "LOW",
            remediation: "Adopt and enforce a single naming convention for the project. Use ESLint's camelcase rule or a naming-convention rule set.",
            aiSuggestion: `// Bad — mixed conventions in same file\nconst user_name = getUser();\nconst UserAge = 25;\n\n// Good — consistent camelCase\nconst userName = getUser();\nconst userAge = 25;`,
          },
        ];

        // ── Code quality / best practice findings (Code Quality, pure code errors) ──
        const qualityTemplates = [
          {
            title: "Excessive Function Complexity",
            description: "This function has a cyclomatic complexity score above 15, meaning it contains too many branching paths. High complexity makes the function hard to test, easy to misunderstand, and prone to bugs during modifications.",
            cwe: "1121", severity: "MEDIUM",
            remediation: "Break the function into smaller, single-purpose functions each with complexity ≤ 10. Use early-return guards to flatten nested conditionals.",
            aiSuggestion: `// Before: one function handling 8 conditions\nfunction processOrder(order) { /* 80 lines of nested ifs */ }\n\n// After: decomposed\nfunction validateOrder(order) { ... }\nfunction applyDiscounts(order) { ... }\nfunction chargePayment(order) { ... }`,
          },
          {
            title: "Deprecated API Usage",
            description: "The codebase calls an API or function that has been marked deprecated. Deprecated APIs may be removed in future runtime versions and often have known bugs that the replacement resolves.",
            cwe: "477", severity: "MEDIUM",
            remediation: "Migrate to the recommended replacement listed in the API documentation. Set up lint rules to prevent future use of the deprecated call.",
            aiSuggestion: `// Bad — deprecated\nrequire('url').parse(rawUrl);\n\n// Good — modern replacement\nnew URL(rawUrl);`,
          },
          {
            title: "Missing Error Handling",
            description: "An async operation is awaited or a Promise is consumed without a try/catch or .catch() handler. Unhandled rejections crash the process (Node 15+) or produce silent failures that are invisible in monitoring.",
            cwe: "391", severity: "HIGH",
            remediation: "Wrap all async calls in try/catch. Use a global unhandledRejection handler as a last resort safety net.",
            aiSuggestion: `// Bad — no error handling\nasync function loadUser(id) {\n  const user = await db.find(id);\n  return user;\n}\n\n// Good\nasync function loadUser(id) {\n  try {\n    const user = await db.find(id);\n    return user;\n  } catch (err) {\n    logger.error('Failed to load user', { id, err });\n    throw new AppError('User not found', 404);\n  }\n}`,
          },
          {
            title: "Missing Type Annotation",
            description: "Public function parameters or return values lack TypeScript type annotations. Implicit any types bypass the compiler's type checker, allowing type-related bugs to slip into production.",
            cwe: "1173", severity: "LOW",
            remediation: "Add explicit parameter types and return type annotations to all public-facing functions. Enable strict: true in tsconfig to catch missing annotations.",
            aiSuggestion: `// Bad — implicit any\nfunction getUser(id) {\n  return db.findUser(id);\n}\n\n// Good — fully typed\nasync function getUser(id: string): Promise<User | null> {\n  return db.findUser(id);\n}`,
          },
        ];

        let createdCount = 0;
        const saveFind = async (t: typeof securityOnlyTemplates[0], cat: string, sev: string, riskMin: number) => {
          await storage.createFinding({
            userId: scan.userId,
            title: t.title,
            description: t.description,
            severity: sev,
            category: cat,
            asset: scan.repositoryUrl || "Code Repository",
            cwe: t.cwe,
            detected: new Date().toISOString(),
            status: "open",
            location: `${randFile()}:${randLine()}`,
            remediation: t.remediation,
            aiSuggestion: t.aiSuggestion,
            riskScore: Math.floor(Math.random() * 15) + riskMin,
            source: "linter-scan",
            linterScanId: scan.id,
            scanId: scan.id,
            scanType: "linter",
          });
          createdCount++;
        };

        // Security-only findings
        for (let i = 0; i < Math.min(securityIssues, securityOnlyTemplates.length); i++) {
          if (createdCount >= mockIssues) break;
          await saveFind(securityOnlyTemplates[i], "Code Security", securityOnlyTemplates[i].severity, 55);
        }
        // Overlap (security + code error) findings
        for (let i = 0; i < overlapSecurityTemplates.length && createdCount < mockIssues; i++) {
          await saveFind(overlapSecurityTemplates[i], "Code Security", overlapSecurityTemplates[i].severity, 65);
        }
        // Code quality findings
        for (let i = 0; i < Math.min(bestPracticeIssues, qualityTemplates.length) && createdCount < mockIssues; i++) {
          await saveFind(qualityTemplates[i], "Code Quality", qualityTemplates[i].severity, 25);
        }
        // Code hygiene findings
        for (let i = 0; i < Math.min(hygieneIssues, hygieneTemplates.length) && createdCount < mockIssues; i++) {
          await saveFind(hygieneTemplates[i], "Code Hygiene", hygieneTemplates[i].severity, 5);
        }

        await storage.updateLinterScan(scan.id, scan.userId, {
          scanStatus: 'completed',
          scannedAt: new Date(),
          issuesCount: mockIssues,
          hygieneIssuesCount: hygieneIssues,
          bestPracticeIssuesCount: bestPracticeIssues,
          securityIssuesCount: securityIssues,
        });

        // Send push notification for scan completion
        await notifyScanComplete(
          storage,
          scan.userId,
          scan.id,
          'linter',
          'Linter Scan',
          mockIssues
        );
      }, 4000);

      res.status(201).json(scan);
    } catch (error: any) {
      if (error instanceof ZodError) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  app.patch("/api/linter-scans/:id", requireAuth, async (req: any, res) => {
    try {
      const validatedData = insertLinterScanSchema.partial().parse(req.body);
      const scan = await storage.updateLinterScan(req.params.id, req.user.id, validatedData);
      if (!scan) {
        return res.status(404).json({ message: "Linter scan not found" });
      }
      res.json(scan);
    } catch (error: any) {
      if (error instanceof ZodError) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  // Folder scan endpoint — scans a local folder path for code issues
  app.post("/api/linter-scans/folder-scan", requireAuth, async (req: any, res) => {
    try {
      const { folderPath, projectName, language, fileTypes, scanDepth, enableSecurity, enableHygiene, enableBestPractices } = req.body;
      if (!folderPath || !projectName || !language) {
        return res.status(400).json({ message: "folderPath, projectName, and language are required" });
      }

      const scan = await storage.createLinterScan({
        userId: req.user.id,
        repositoryUrl: `folder://${folderPath}`,
        projectName,
        language,
        scanStatus: "scanning",
      });

      res.status(201).json(scan);

      // Simulate async folder analysis with detailed per-file findings
      setTimeout(async () => {
        const extensions = fileTypes?.length ? fileTypes : (
          language === "javascript" ? ["js", "jsx"] :
          language === "typescript" ? ["ts", "tsx"] :
          language === "python" ? ["py"] :
          language === "java" ? ["java"] :
          language === "go" ? ["go"] :
          ["js", "ts", "py"]
        );

        const maxDepth = scanDepth === "shallow" ? 2 : scanDepth === "deep" ? 5 : 3;

        // Generate realistic folder structure based on folderPath and language
        const folderSegments = folderPath.replace(/^[./]+/, "").split("/").filter(Boolean);
        const baseFolder = folderSegments.length > 0 ? folderSegments[folderSegments.length - 1] : "src";

        const subDirs = ["components", "utils", "services", "lib", "helpers", "hooks", "api", "models", "types", "config"];
        const usedDirs = subDirs.slice(0, Math.min(maxDepth + 1, subDirs.length));

        const fileTemplates = [
          { name: "index", ext: extensions[0] },
          { name: "main", ext: extensions[0] },
          { name: "app", ext: extensions[0] },
          { name: "auth", ext: extensions[0] },
          { name: "utils", ext: extensions[0] },
          { name: "config", ext: extensions[0] },
          { name: "database", ext: extensions[0] },
          { name: "api", ext: extensions[0] },
        ];

        // Issue templates with specific before/after recommendations
        const issueTemplates = [
          {
            type: "security",
            enabled: enableSecurity !== false,
            items: [
              {
                title: "SQL Injection Risk",
                severity: "CRITICAL",
                cwe: "89",
                category: "Code Security",
                description: "String concatenation used to build SQL query, allowing potential SQL injection attacks.",
                remediation: "Use parameterized queries or prepared statements instead of string concatenation.",
                aiSuggestion: "BEFORE:\n  const query = `SELECT * FROM users WHERE id = ${userId}`;\n\nAFTER:\n  const query = 'SELECT * FROM users WHERE id = ?';\n  db.execute(query, [userId]);",
              },
              {
                title: "Hardcoded Secret Detected",
                severity: "CRITICAL",
                cwe: "798",
                category: "Code Security",
                description: "API key or password hardcoded in source code. This exposes sensitive credentials in version control.",
                remediation: "Move secrets to environment variables and use a secrets management solution.",
                aiSuggestion: "BEFORE:\n  const API_KEY = 'sk-abc123...';\n\nAFTER:\n  const API_KEY = process.env.API_KEY;\n  if (!API_KEY) throw new Error('API_KEY env var required');",
              },
              {
                title: "Unvalidated User Input",
                severity: "HIGH",
                cwe: "20",
                category: "Code Security",
                description: "User-supplied input is used without validation or sanitization, risking XSS and injection.",
                remediation: "Validate and sanitize all user inputs before processing or displaying them.",
                aiSuggestion: "BEFORE:\n  element.innerHTML = userInput;\n\nAFTER:\n  element.textContent = userInput; // or use DOMPurify.sanitize(userInput)",
              },
              {
                title: "Missing Authentication Check",
                severity: "HIGH",
                cwe: "306",
                category: "Code Security",
                description: "Sensitive endpoint or function lacks proper authentication verification.",
                remediation: "Add authentication middleware or check to protect this route/function.",
                aiSuggestion: "BEFORE:\n  app.get('/admin/data', handler);\n\nAFTER:\n  app.get('/admin/data', requireAuth, requireAdmin, handler);",
              },
            ],
          },
          {
            type: "hygiene",
            enabled: enableHygiene !== false,
            items: [
              {
                title: "Unused Variable Declaration",
                severity: "LOW",
                cwe: "563",
                category: "Code Hygiene",
                description: "Variable is declared but never used, adding unnecessary clutter to the codebase.",
                remediation: "Remove unused variables or prefix with underscore if intentionally unused.",
                aiSuggestion: "BEFORE:\n  const unusedVar = getData();\n  return result;\n\nAFTER:\n  return result; // Remove unused variable",
              },
              {
                title: "Dead Code Block",
                severity: "LOW",
                cwe: "561",
                category: "Code Hygiene",
                description: "Code block is unreachable or never executed, reducing readability.",
                remediation: "Remove dead code to keep the codebase clean and maintainable.",
                aiSuggestion: "BEFORE:\n  return value;\n  console.log('never reached'); // dead code\n\nAFTER:\n  return value;",
              },
              {
                title: "Inconsistent Naming Convention",
                severity: "LOW",
                cwe: "1099",
                category: "Code Hygiene",
                description: "Variable or function names mix camelCase and snake_case, reducing readability.",
                remediation: "Adopt and consistently follow a single naming convention throughout the codebase.",
                aiSuggestion: "BEFORE:\n  const user_name = getUser();\n  const userId = getUser();\n\nAFTER:\n  const userName = getUser();\n  const userId = getUser();",
              },
              {
                title: "Empty Catch Block — Swallows Exceptions",
                severity: "MEDIUM",
                cwe: "391",
                category: "Code Hygiene",
                description: "A catch block is completely empty, silently ignoring all exceptions. This is a code hygiene problem that also has security implications: errors from authentication, authorisation, and cryptographic operations will be silently swallowed, hiding active attacks.",
                remediation: "Always log the caught error or re-throw it. Add a comment if suppression is intentional and add the exception to your monitoring.",
                aiSuggestion: "BEFORE:\n  try {\n    await verifyToken(req.headers.authorization);\n  } catch (e) {} // security events hidden\n\nAFTER:\n  try {\n    await verifyToken(req.headers.authorization);\n  } catch (e) {\n    logger.warn('Token verification failed', { error: e.message });\n    throw new UnauthorizedError();\n  }",
              },
              {
                title: "Sensitive Data in Logs via console.log",
                severity: "MEDIUM",
                cwe: "532",
                category: "Code Hygiene",
                description: "Passwords, tokens, or personal data are printed to console logs. This is a code hygiene mistake (console.log should be replaced with a structured logger) and a security vulnerability because log files are often stored in plaintext and accessible to operations personnel or leaked in breaches.",
                remediation: "Replace console.log with a structured logger. Configure redaction rules for sensitive field names (password, token, authorization, ssn, creditCard).",
                aiSuggestion: "BEFORE:\n  console.log('Login attempt:', { email, password, sessionToken });\n\nAFTER:\n  logger.info('Login attempt', { email, sessionToken: '[REDACTED]' });",
              },
            ],
          },
          {
            type: "bestPractice",
            enabled: enableBestPractices !== false,
            items: [
              {
                title: "Deprecated API Usage",
                severity: "MEDIUM",
                cwe: "477",
                category: "Code Quality",
                description: "Using a deprecated API that may be removed in future versions.",
                remediation: "Replace deprecated API with its modern equivalent.",
                aiSuggestion: "BEFORE:\n  const result = require('querystring').parse(str);\n\nAFTER:\n  const result = new URLSearchParams(str);",
              },
              {
                title: "High Cyclomatic Complexity",
                severity: "MEDIUM",
                cwe: "1121",
                category: "Code Quality",
                description: "Function has too many branching paths, making it hard to test and maintain.",
                remediation: "Refactor to extract helper functions and reduce nesting depth.",
                aiSuggestion: "BEFORE:\n  function process(data) {\n    if (a) { if (b) { if (c) { /* ... */ } } }\n  }\n\nAFTER:\n  function process(data) {\n    if (!a || !b || !c) return;\n    handleCase();\n  }",
              },
              {
                title: "Missing Error Handling",
                severity: "MEDIUM",
                cwe: "391",
                category: "Code Quality",
                description: "Async operation or promise is not wrapped in try/catch or .catch() handler.",
                remediation: "Add proper error handling to prevent unhandled promise rejections.",
                aiSuggestion: "BEFORE:\n  const data = await fetchData();\n\nAFTER:\n  try {\n    const data = await fetchData();\n  } catch (error) {\n    logger.error('Fetch failed:', error);\n    throw error;\n  }",
              },
              {
                title: "No Input Type Validation",
                severity: "MEDIUM",
                cwe: "843",
                category: "Code Quality",
                description: "Function parameters lack type checks, risking runtime type errors.",
                remediation: "Add parameter type validation or use TypeScript for static typing.",
                aiSuggestion: "BEFORE:\n  function calculate(value) {\n    return value * 2;\n  }\n\nAFTER:\n  function calculate(value: number): number {\n    if (typeof value !== 'number') throw new TypeError('Expected number');\n    return value * 2;\n  }",
              },
            ],
          },
        ];

        let totalCreated = 0;
        let securityCount = 0;
        let hygieneCount = 0;
        let bestPracticeCount = 0;

        // For each used sub-directory, assign some files and issues
        for (const dir of usedDirs) {
          const filesInDir = fileTemplates.slice(0, Math.floor(Math.random() * 2) + 1);
          for (const file of filesInDir) {
            const fileIssues = Math.floor(Math.random() * 3) + 1;
            for (let i = 0; i < fileIssues; i++) {
              // Pick a random issue type
              const enabledTypes = issueTemplates.filter(t => t.enabled && t.items.length > 0);
              if (enabledTypes.length === 0) break;
              const typeGroup = enabledTypes[Math.floor(Math.random() * enabledTypes.length)];
              const template = typeGroup.items[Math.floor(Math.random() * typeGroup.items.length)];
              const lineNum = Math.floor(Math.random() * 200) + 1;
              const colNum = Math.floor(Math.random() * 40) + 1;

              await storage.createFinding({
                userId: scan.userId,
                title: template.title,
                description: template.description,
                severity: template.severity,
                category: template.category,
                asset: `${baseFolder}/${dir}/${file.name}.${file.ext}`,
                cwe: template.cwe,
                detected: new Date().toISOString(),
                status: "open",
                location: `${baseFolder}/${dir}/${file.name}.${file.ext}:${lineNum}:${colNum}`,
                remediation: template.remediation,
                aiSuggestion: template.aiSuggestion,
                riskScore: template.severity === "CRITICAL" ? Math.floor(Math.random() * 10) + 88 :
                           template.severity === "HIGH" ? Math.floor(Math.random() * 15) + 70 :
                           template.severity === "MEDIUM" ? Math.floor(Math.random() * 20) + 45 :
                           Math.floor(Math.random() * 25) + 15,
                source: "linter-scan",
                linterScanId: scan.id,
                scanId: scan.id,
                scanType: "linter",
              });

              totalCreated++;
              if (typeGroup.type === "security") securityCount++;
              else if (typeGroup.type === "hygiene") hygieneCount++;
              else bestPracticeCount++;
            }
          }
        }

        await storage.updateLinterScan(scan.id, scan.userId, {
          scanStatus: "completed",
          scannedAt: new Date(),
          issuesCount: totalCreated,
          hygieneIssuesCount: hygieneCount,
          bestPracticeIssuesCount: bestPracticeCount,
          securityIssuesCount: securityCount,
        });

        await notifyScanComplete(
          storage,
          scan.userId,
          scan.id,
          "linter",
          "Folder Scan",
          totalCreated
        );
      }, 5000);

    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Code snippet scan — user pastes code to check for vulnerabilities
  app.post("/api/linter-scans/code-snippet", requireAuth, async (req: any, res) => {
    try {
      const { code, projectName, language, filename, enableSecurity, enableHygiene, enableBestPractices } = req.body;
      if (!code || !projectName || !language) {
        return res.status(400).json({ message: "code, projectName, and language are required" });
      }

      const scan = await storage.createLinterScan({
        userId: req.user.id,
        repositoryUrl: `snippet://${filename || "pasted-code"}`,
        projectName,
        language,
        scanStatus: "scanning",
        codeContent: code,
      });

      res.status(201).json(scan);

      setTimeout(async () => {
        const ext = language === "typescript" ? "ts" : language === "javascript" ? "js" :
                    language === "python" ? "py" : language === "java" ? "java" :
                    language === "go" ? "go" : "txt";
        const displayFile = filename || `snippet.${ext}`;
        const codeLines = code.split("\n");
        const lineCount = codeLines.length;

        // ── Auto-detect language from code content ────────────────────────────
        // This ensures patterns run correctly even when the user leaves the
        // language selector on its default (TypeScript).
        const PYTHON_SIGNALS: RegExp[] = [
          /^\s*def\s+\w+\s*\(/m,                     // function definition
          /^\s*import\s+[\w.]+\s*$/m,                 // bare import
          /^\s*from\s+[\w.]+\s+import\s+/m,           // from X import Y
          /\bprint\s*\(/,                              // print(
          /^\s*#[^!]/m,                               // Python comment (not shebang)
          /\bself\b/,                                  // self parameter
          /^if\s+__name__\s*==\s*["']__main__["']/m, // __main__ guard
          /^\s*elif\b/m,                               // elif keyword
          /:\s*$/.test(code) ? /x/ : /:\s*\n\s+\w/m, // colon-body indentation
        ];
        const pythonSignalCount = PYTHON_SIGNALS.filter(p => p.test(code)).length;
        // Treat as Python if ≥ 2 strong signals, even if user selected TS/JS
        const effectiveLang: string = pythonSignalCount >= 2 ? "python" : language;
        const isPy: boolean = effectiveLang === "python";
        // ─────────────────────────────────────────────────────────────────────

        // Analyze the actual code text for common patterns
        const detectedIssues: Array<{
          title: string; severity: string; cwe: string; category: string;
          description: string; remediation: string; aiSuggestion: string; line: number;
        }> = [];

        if (enableSecurity !== false) {
          // ── Helper: find first line matching a pattern ─────────────────────
          const scan = (pattern: RegExp): { idx: number; raw: string; trimmed: string } | null => {
            const idx = codeLines.findIndex((l: string) => pattern.test(l));
            if (idx < 0) return null;
            return { idx, raw: codeLines[idx], trimmed: codeLines[idx].trim() };
          };
          const scanAll = (pattern: RegExp): { idx: number; trimmed: string }[] =>
            codeLines
              .map((l: string, i: number) => ({ idx: i, trimmed: l.trim() }))
              .filter(({ trimmed }: { trimmed: string }) => pattern.test(trimmed));

          // ── 1. SQL Injection ───────────────────────────────────────────────
          const sqlPatterns = [
            // JS/TS: template literals or concatenation in SQL
            /(?:SELECT|INSERT|UPDATE|DELETE|FROM|WHERE).*\$\{/i,
            /(?:query|sql|stmt)\s*[+=]\s*[`"'].*\+\s*\w/i,
            /db\.(query|execute|run)\s*\(\s*[`"'].*\$\{/i,
            // Python: f-string, %-format, or concatenation inside execute()
            /(?:cursor|conn|db)\.execute\s*\(\s*(?:f["']|["'][^"']*%[^s]|["'][^"']*\+)/i,
            /(?:cursor|conn|db)\.execute\s*\(\s*["'][^"']*(SELECT|INSERT|UPDATE|DELETE)[^"']*["']\s*%/i,
            /(?:cursor|conn|db)\.execute\s*\(\s*f["']/i,
            /(?:cursor|conn|db)\.execute\s*\(.*\+\s*\w/i,
          ];
          const sqlHit = sqlPatterns.reduce((found: { idx: number; raw: string; trimmed: string } | null, p) => found || scan(p), null);
          if (sqlHit) {
            detectedIssues.push({
              title: "SQL Injection — Unsanitised Input in Query",
              severity: "CRITICAL", cwe: "89", category: "Code Security",
              description: `Line ${sqlHit.idx + 1}: \`${sqlHit.trimmed}\`\n\nThis line builds a SQL query by embedding a variable directly into the query string. An attacker who controls that variable can inject arbitrary SQL — reading, modifying, or deleting any data in the database.\n\nThe dangerous part is the string interpolation/concatenation where user-controlled input reaches the SQL string without parameterisation.`,
              remediation: isPy
                ? "Pass user values as the second argument to cursor.execute() — never build the SQL string from them."
                : "Use parameterised queries: pass the SQL string with placeholders (? or $1) and values separately. Never build SQL with string concatenation.",
              aiSuggestion: isPy
                ? `VULNERABLE LINE (line ${sqlHit.idx + 1}):\n  ${sqlHit.trimmed}\n  ${"^".repeat(Math.min(sqlHit.trimmed.length, 60))}\n  ↑ user input reaches SQL string directly\n\nFIXED — use parameterised query:\n  # BEFORE (vulnerable):\n  ${sqlHit.trimmed}\n\n  # AFTER (safe):\n  cursor.execute("SELECT * FROM users WHERE name = %s", (username,))\n  # The second argument tuple is sanitised automatically by the DB driver`
                : `VULNERABLE LINE (line ${sqlHit.idx + 1}):\n  ${sqlHit.trimmed}\n  ${"^".repeat(Math.min(sqlHit.trimmed.length, 60))}\n  ↑ variable interpolated directly into SQL\n\nFIXED — use parameterised query:\n  // BEFORE (vulnerable):\n  ${sqlHit.trimmed}\n\n  // AFTER (safe):\n  const q = 'SELECT * FROM users WHERE id = ?';\n  db.query(q, [id]);  // driver sanitises values automatically`,
              line: sqlHit.idx + 1,
            });
          }

          // ── 2. Hardcoded Credentials ───────────────────────────────────────
          const secretHit = scan(/(?:password|passwd|pwd|secret|api_key|apikey|access_key|auth_token|private_key|client_secret)\s*[:=]\s*["'`][A-Za-z0-9!@#$%^&*()\-_+=]{6,}/i);
          if (secretHit) {
            const varMatch = secretHit.trimmed.match(/^(\w+)\s*[:=]/);
            const varName = varMatch ? varMatch[1] : "credential";
            detectedIssues.push({
              title: "Hardcoded Credential in Source Code",
              severity: "CRITICAL", cwe: "798", category: "Code Security",
              description: `Line ${secretHit.idx + 1}: \`${secretHit.trimmed}\`\n\nA secret value is hard-coded directly into the source file. If this file is committed to version control (Git, GitHub, etc.) the secret is exposed to everyone with read access — including public repositories. Secrets embedded in code cannot be rotated without a code change.`,
              remediation: isPy
                ? "Load the value from an environment variable using os.environ.get(). Store secrets in a .env file (excluded from git via .gitignore) or a secrets manager."
                : "Load the value from process.env at runtime. Store secrets in a .env file excluded from git, or use a secrets manager (AWS Secrets Manager, Vault, etc.).",
              aiSuggestion: isPy
                ? `VULNERABLE LINE (line ${secretHit.idx + 1}):\n  ${secretHit.trimmed}\n  ${"^".repeat(Math.min(secretHit.trimmed.length, 60))}\n  ↑ secret hardcoded — visible to anyone with code access\n\nFIXED — load from environment:\n  import os\n\n  # BEFORE (dangerous):\n  ${secretHit.trimmed}\n\n  # AFTER (safe):\n  ${varName} = os.environ.get("${varName.toUpperCase()}")\n  if not ${varName}:\n      raise EnvironmentError("${varName.toUpperCase()} environment variable is not set")\n\n  # Add to .env file (never commit this file):\n  # ${varName.toUpperCase()}=your_actual_secret_here\n  # And add .env to .gitignore`
                : `VULNERABLE LINE (line ${secretHit.idx + 1}):\n  ${secretHit.trimmed}\n  ${"^".repeat(Math.min(secretHit.trimmed.length, 60))}\n  ↑ secret hardcoded — visible in version control\n\nFIXED — load from environment:\n  // BEFORE (dangerous):\n  ${secretHit.trimmed}\n\n  // AFTER (safe):\n  const ${varName} = process.env.${varName.toUpperCase()};\n  if (!${varName}) throw new Error("${varName.toUpperCase()} environment variable is required");\n\n  // .env file (never commit this):\n  // ${varName.toUpperCase()}=your_actual_secret_here`,
              line: secretHit.idx + 1,
            });
          }

          // ── 3. eval() / exec() code injection ─────────────────────────────
          const evalHit = scan(/\beval\s*\(|\bexec\s*\(/);
          if (evalHit) {
            const fn = evalHit.trimmed.includes("exec(") ? "exec" : "eval";
            detectedIssues.push({
              title: `Dangerous ${fn}() — Arbitrary Code Execution`,
              severity: "HIGH", cwe: "95", category: "Code Security",
              description: `Line ${evalHit.idx + 1}: \`${evalHit.trimmed}\`\n\n${fn}() executes the string passed to it as live code. If any part of that string is derived from user input, network data, or a file, an attacker can inject and run arbitrary code on your server or in the user's browser — a Remote Code Execution (RCE) vulnerability.`,
              remediation: isPy
                ? "Remove exec()/eval(). Parse structured data with json.loads() or ast.literal_eval() (safe for Python literals only). Never execute user-supplied strings as code."
                : "Remove eval(). Parse JSON with JSON.parse(). For mathematical expressions use a sandboxed evaluator library. Never pass user input to eval().",
              aiSuggestion: isPy
                ? `VULNERABLE LINE (line ${evalHit.idx + 1}):\n  ${evalHit.trimmed}\n  ${"^".repeat(Math.min(evalHit.trimmed.length, 60))}\n  ↑ string executed as Python code — attacker can inject any statement\n\nFIXED — use safe alternatives:\n  # BEFORE (dangerous):\n  ${evalHit.trimmed}\n\n  # AFTER — if parsing data, use ast.literal_eval (Python literals only):\n  import ast\n  result = ast.literal_eval(user_input)  # safe for numbers, lists, dicts\n\n  # AFTER — if parsing JSON:\n  import json\n  result = json.loads(user_input)`
                : `VULNERABLE LINE (line ${evalHit.idx + 1}):\n  ${evalHit.trimmed}\n  ${"^".repeat(Math.min(evalHit.trimmed.length, 60))}\n  ↑ string passed directly to eval() — attacker controls execution\n\nFIXED — use safe alternatives:\n  // BEFORE (dangerous):\n  ${evalHit.trimmed}\n\n  // AFTER — parse JSON safely:\n  const result = JSON.parse(userInput);\n\n  // AFTER — for math expressions, use a sandboxed library:\n  import { evaluate } from 'mathjs';\n  const result = evaluate(expression); // sandboxed, no code execution`,
              line: evalHit.idx + 1,
            });
          }

          // ── 4. XSS via innerHTML / document.write / dangerouslySetInnerHTML
          const xssHit = scan(/\.innerHTML\s*=|document\.write\s*\(|dangerouslySetInnerHTML/);
          if (xssHit) {
            const method = xssHit.trimmed.includes("document.write") ? "document.write()"
              : xssHit.trimmed.includes("dangerouslySetInnerHTML") ? "dangerouslySetInnerHTML"
              : "innerHTML";
            detectedIssues.push({
              title: `XSS Vulnerability — Unsafe DOM Write via ${method}`,
              severity: "HIGH", cwe: "79", category: "Code Security",
              description: `Line ${xssHit.idx + 1}: \`${xssHit.trimmed}\`\n\nThis line writes content directly into the DOM using ${method}. If the content contains any user-supplied, URL-derived, or API-returned data, an attacker can inject a <script> tag or event handler that executes in the victim's browser — stealing sessions, redirecting to phishing sites, or performing actions on behalf of the user (Cross-Site Scripting).`,
              remediation: "Use textContent (not innerHTML) for plain text. If HTML must be rendered, sanitize it first with DOMPurify.sanitize() before assignment. Never write unsanitised data to the DOM.",
              aiSuggestion: `VULNERABLE LINE (line ${xssHit.idx + 1}):\n  ${xssHit.trimmed}\n  ${"^".repeat(Math.min(xssHit.trimmed.length, 60))}\n  ↑ unsanitised content rendered as HTML — attacker can inject <script>\n\nFIXED:\n  // BEFORE (vulnerable):\n  ${xssHit.trimmed}\n\n  // AFTER — plain text (no HTML interpretation):\n  element.textContent = userContent;\n\n  // AFTER — if HTML formatting is required:\n  import DOMPurify from 'dompurify';\n  element.innerHTML = DOMPurify.sanitize(userContent);\n  // DOMPurify strips all script tags and dangerous attributes`,
              line: xssHit.idx + 1,
            });
          }

          // ── 5. Sensitive data in logs ──────────────────────────────────────
          const logPatterns = [
            /console\.log\s*\(.*(?:password|passwd|token|secret|key|auth|credential)/i,
            /print\s*\(.*(?:password|passwd|token|secret|key|auth|credential)/i,
            /logging\.\w+\s*\(.*(?:password|passwd|token|secret|key|auth|credential)/i,
          ];
          const logHit = logPatterns.reduce((found: { idx: number; raw: string; trimmed: string } | null, p) => found || scan(p), null);
          if (logHit) {
            detectedIssues.push({
              title: "Sensitive Data Exposed in Logs",
              severity: "HIGH", cwe: "532", category: "Code Security",
              description: `Line ${logHit.idx + 1}: \`${logHit.trimmed}\`\n\nThis line logs a value whose name suggests it contains a credential or secret (password, token, key, etc.). Log files are stored on disk, shipped to log aggregators (Splunk, CloudWatch, Datadog), and accessible to many people. Logging secrets means they leak outside the application boundary.`,
              remediation: "Never log raw credential values. Log only boolean presence (!!token) or a masked version ('****' + token.slice(-4)).",
              aiSuggestion: isPy
                ? `VULNERABLE LINE (line ${logHit.idx + 1}):\n  ${logHit.trimmed}\n  ${"^".repeat(Math.min(logHit.trimmed.length, 60))}\n  ↑ secret value written to log output\n\nFIXED — log presence, not value:\n  # BEFORE (leaks secret):\n  ${logHit.trimmed}\n\n  # AFTER (safe — logs only whether it exists):\n  print("Auth token present:", bool(auth_token))\n\n  # AFTER (safe — masked, shows last 4 chars only):\n  print("Token (masked):", "****" + auth_token[-4:])`
                : `VULNERABLE LINE (line ${logHit.idx + 1}):\n  ${logHit.trimmed}\n  ${"^".repeat(Math.min(logHit.trimmed.length, 60))}\n  ↑ secret value written to log output\n\nFIXED — log presence, not value:\n  // BEFORE (leaks secret):\n  ${logHit.trimmed}\n\n  // AFTER (safe — logs only whether it exists):\n  console.log('Auth token present:', !!authToken);\n\n  // AFTER (safe — masked):\n  console.log('Token (masked):', '****' + authToken.slice(-4));`,
              line: logHit.idx + 1,
            });
          }

          // ── 6. Python: subprocess with shell=True (command injection) ──────
          if (effectiveLang === "python") {
            const shellHit = scan(/subprocess\.\w+\s*\(.*shell\s*=\s*True/i) ||
                             scan(/os\.system\s*\(/) ||
                             scan(/os\.popen\s*\(/);
            if (shellHit) {
              detectedIssues.push({
                title: "Command Injection — Shell Execution with User Input",
                severity: "CRITICAL", cwe: "78", category: "Code Security",
                description: `Line ${shellHit.idx + 1}: \`${shellHit.trimmed}\`\n\nThis line passes a command to the system shell (shell=True, os.system, or os.popen). If any part of the command string is derived from user input, an attacker can append shell metacharacters (; | && || $()) to run arbitrary operating system commands — reading files, creating users, exfiltrating data, or installing malware.`,
                remediation: "Use subprocess.run() with shell=False (the default) and pass the command as a list. Never interpolate user input into shell strings.",
                aiSuggestion: `VULNERABLE LINE (line ${shellHit.idx + 1}):\n  ${shellHit.trimmed}\n  ${"^".repeat(Math.min(shellHit.trimmed.length, 60))}\n  ↑ shell interprets the string — attacker can inject ; rm -rf /\n\nFIXED — pass command as list, no shell:\n  # BEFORE (dangerous — shell=True):\n  ${shellHit.trimmed}\n\n  # AFTER (safe — list form, shell=False by default):\n  import subprocess\n  result = subprocess.run(["ping", hostname], capture_output=True, text=True)\n  # Each element is passed as a literal argument — no shell interpretation\n  # Attacker cannot inject shell metacharacters`,
                line: shellHit.idx + 1,
              });
            }

            // ── 7. Python: pickle.loads() — insecure deserialization ─────────
            const pickleHit = scan(/pickle\.loads?\s*\(/);
            if (pickleHit) {
              detectedIssues.push({
                title: "Insecure Deserialization — pickle.load()",
                severity: "CRITICAL", cwe: "502", category: "Code Security",
                description: `Line ${pickleHit.idx + 1}: \`${pickleHit.trimmed}\`\n\nPickle can deserialize any Python object, including ones with __reduce__ methods that execute arbitrary code on load. If the data being unpickled comes from an untrusted source (user upload, network, database), an attacker can craft a payload that runs any code when your application calls pickle.load(). This is a well-known Python-specific RCE vector.`,
                remediation: "Never unpickle data from untrusted sources. Use json.loads() or msgpack for serialisation between services. If you must use pickle, sign and verify the data with hmac before deserializing.",
                aiSuggestion: `VULNERABLE LINE (line ${pickleHit.idx + 1}):\n  ${pickleHit.trimmed}\n  ${"^".repeat(Math.min(pickleHit.trimmed.length, 60))}\n  ↑ deserializing untrusted bytes — attacker can execute arbitrary code\n\nFIXED — use JSON instead:\n  # BEFORE (dangerous):\n  ${pickleHit.trimmed}\n\n  # AFTER (safe — JSON only supports data, not code):\n  import json\n  data = json.loads(raw_bytes.decode('utf-8'))\n\n  # If binary format is required, use msgpack (data-only):\n  import msgpack\n  data = msgpack.unpackb(raw_bytes, raw=False)`,
                line: pickleHit.idx + 1,
              });
            }

            // ── 8. Python: yaml.load() without SafeLoader ────────────────────
            const yamlHit = scan(/yaml\.load\s*\([^)]*\)(?!\s*,\s*Loader\s*=\s*yaml\.SafeLoader)/);
            if (yamlHit || scan(/yaml\.load\s*\(/)) {
              const hit = yamlHit || scan(/yaml\.load\s*\(/)!;
              detectedIssues.push({
                title: "Unsafe YAML Deserialization — yaml.load() Without SafeLoader",
                severity: "HIGH", cwe: "502", category: "Code Security",
                description: `Line ${hit.idx + 1}: \`${hit.trimmed}\`\n\nPyYAML's yaml.load() without Loader=yaml.SafeLoader can deserialize Python objects including those that execute system commands via the !!python/object/apply: tag. Supplying a crafted YAML document can achieve Remote Code Execution. yaml.safe_load() only allows standard YAML data types.`,
                remediation: "Replace yaml.load() with yaml.safe_load(), or explicitly pass Loader=yaml.SafeLoader.",
                aiSuggestion: `VULNERABLE LINE (line ${hit.idx + 1}):\n  ${hit.trimmed}\n  ${"^".repeat(Math.min(hit.trimmed.length, 60))}\n  ↑ yaml.load() without SafeLoader can execute arbitrary Python code\n\nFIXED — use safe_load:\n  # BEFORE (dangerous):\n  ${hit.trimmed}\n\n  # AFTER (safe):\n  data = yaml.safe_load(stream)\n\n  # OR explicitly set the loader:\n  data = yaml.load(stream, Loader=yaml.SafeLoader)`,
                line: hit.idx + 1,
              });
            }

            // ── 9. Python: MD5/SHA1 for password hashing ────────────────────
            const weakHashHit = scan(/hashlib\.(md5|sha1)\s*\(/i);
            if (weakHashHit) {
              const alg = (weakHashHit.trimmed.match(/hashlib\.(md5|sha1)/i) || [])[1]?.toUpperCase() || "MD5/SHA1";
              detectedIssues.push({
                title: `Weak Password Hashing — ${alg} is Cryptographically Broken`,
                severity: "HIGH", cwe: "916", category: "Code Security",
                description: `Line ${weakHashHit.idx + 1}: \`${weakHashHit.trimmed}\`\n\n${alg} is a general-purpose hash function, not a password hashing algorithm. It is extremely fast, which means an attacker with the hash database can test billions of guesses per second using a GPU. ${alg} hashes for common passwords have been pre-computed in rainbow tables. Passwords hashed with ${alg} should be considered compromised.`,
                remediation: "Use bcrypt, scrypt, or Argon2 — algorithms designed specifically for password storage with configurable cost factors that make brute-force attacks computationally expensive.",
                aiSuggestion: `VULNERABLE LINE (line ${weakHashHit.idx + 1}):\n  ${weakHashHit.trimmed}\n  ${"^".repeat(Math.min(weakHashHit.trimmed.length, 60))}\n  ↑ ${alg} is not a password hashing algorithm — crackable in seconds\n\nFIXED — use bcrypt:\n  # BEFORE (insecure — ${alg}):\n  ${weakHashHit.trimmed}\n\n  # AFTER (secure — bcrypt with work factor):\n  import bcrypt\n  hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(rounds=12))\n\n  # To verify:\n  bcrypt.checkpw(password.encode('utf-8'), hashed)`,
                line: weakHashHit.idx + 1,
              });
            }

            // ── 10. Python: random for security tokens ───────────────────────
            const randomSecHit = scan(/random\.(random|randint|choice|randrange)\s*\(/);
            if (randomSecHit && /token|secret|otp|nonce|session|csrf|key/i.test(code)) {
              detectedIssues.push({
                title: "Insecure Randomness — random Module Used for Security Token",
                severity: "HIGH", cwe: "338", category: "Code Security",
                description: `Line ${randomSecHit.idx + 1}: \`${randomSecHit.trimmed}\`\n\nPython's random module uses a Mersenne Twister PRNG which is not cryptographically secure. If enough outputs are observed, an attacker can predict future values. When random is used to generate tokens, session IDs, OTPs, or CSRF values, those values become guessable.`,
                remediation: "Use the secrets module (Python 3.6+) for all security-sensitive random values. It uses os.urandom() which is cryptographically secure.",
                aiSuggestion: `VULNERABLE LINE (line ${randomSecHit.idx + 1}):\n  ${randomSecHit.trimmed}\n  ${"^".repeat(Math.min(randomSecHit.trimmed.length, 60))}\n  ↑ random is predictable — not suitable for security tokens\n\nFIXED — use secrets module:\n  # BEFORE (insecure — predictable):\n  ${randomSecHit.trimmed}\n\n  # AFTER (secure — cryptographically random):\n  import secrets\n  token = secrets.token_urlsafe(32)    # 32-byte URL-safe token\n  otp   = secrets.randbelow(1000000)   # 6-digit OTP\n  key   = secrets.token_hex(32)        # 64-char hex string`,
                line: randomSecHit.idx + 1,
              });
            }

            // ── 11. Python: debug=True in Flask/Django ───────────────────────
            const debugHit = scan(/debug\s*=\s*True/i);
            if (debugHit && /flask|django|app\.run|runserver/i.test(code)) {
              detectedIssues.push({
                title: "Debug Mode Enabled — Exposes Interactive Debugger",
                severity: "HIGH", cwe: "489", category: "Code Security",
                description: `Line ${debugHit.idx + 1}: \`${debugHit.trimmed}\`\n\nRunning Flask/Django with debug=True in production exposes the Werkzeug interactive debugger at every error page. This debugger provides a Python console in the browser that any visitor can use to execute arbitrary code on the server. It also reveals full stack traces, source code paths, and configuration details.`,
                remediation: "Set debug=False for any internet-facing deployment. Control it via an environment variable so it can never accidentally be True in production.",
                aiSuggestion: `VULNERABLE LINE (line ${debugHit.idx + 1}):\n  ${debugHit.trimmed}\n  ${"^".repeat(Math.min(debugHit.trimmed.length, 60))}\n  ↑ debug=True gives anyone with browser access a live Python console\n\nFIXED — control via environment variable:\n  # BEFORE (dangerous in production):\n  ${debugHit.trimmed}\n\n  # AFTER (reads from environment — safe):\n  import os\n  app.run(debug=os.environ.get("FLASK_DEBUG", "false").lower() == "true")\n\n  # In production .env or deployment config:\n  # FLASK_DEBUG=false`,
                line: debugHit.idx + 1,
              });
            }

            // ── 12. Python: open() with user-controlled path (path traversal)
            const pathTraversalHit = scan(/open\s*\(\s*(?:request\.|user_|input\b|f["']|.*\+\s*\w)/);
            if (pathTraversalHit) {
              detectedIssues.push({
                title: "Path Traversal — open() with User-Controlled Filename",
                severity: "HIGH", cwe: "22", category: "Code Security",
                description: `Line ${pathTraversalHit.idx + 1}: \`${pathTraversalHit.trimmed}\`\n\nThe file path passed to open() appears to include user-supplied input. An attacker can supply a path like ../../../../etc/passwd or ../../config/secrets.env to read arbitrary files on the server's filesystem, including configuration files, private keys, and system passwords.`,
                remediation: "Validate and sanitise the filename: strip path separators, use os.path.basename() to extract only the filename, and confirm the resolved path is within the intended directory using os.path.realpath().",
                aiSuggestion: `VULNERABLE LINE (line ${pathTraversalHit.idx + 1}):\n  ${pathTraversalHit.trimmed}\n  ${"^".repeat(Math.min(pathTraversalHit.trimmed.length, 60))}\n  ↑ user controls path — can read ../../etc/passwd\n\nFIXED — validate and jail the path:\n  # BEFORE (vulnerable):\n  ${pathTraversalHit.trimmed}\n\n  # AFTER (safe — restrict to allowed directory):\n  import os\n  ALLOWED_DIR = "/var/app/uploads"\n  filename = os.path.basename(user_filename)   # strip all path components\n  safe_path = os.path.realpath(os.path.join(ALLOWED_DIR, filename))\n  if not safe_path.startswith(ALLOWED_DIR):\n      raise PermissionError("Access denied")\n  with open(safe_path) as f:\n      data = f.read()`,
                line: pathTraversalHit.idx + 1,
              });
            }
          }

          // ── 13. JS/TS: localStorage / sessionStorage for secrets ───────────
          if (effectiveLang === "javascript" || effectiveLang === "typescript") {
            const storageHit = scan(/localStorage\.setItem\s*\(.*(?:token|auth|secret|key|password)/i) ||
                               scan(/sessionStorage\.setItem\s*\(.*(?:token|auth|secret|key|password)/i);
            if (storageHit) {
              detectedIssues.push({
                title: "Sensitive Token Stored in localStorage/sessionStorage",
                severity: "HIGH", cwe: "922", category: "Code Security",
                description: `Line ${storageHit.idx + 1}: \`${storageHit.trimmed}\`\n\nLocalStorage and sessionStorage are accessible to any JavaScript running on the same origin. If the application has a Cross-Site Scripting (XSS) vulnerability anywhere — even in a third-party script — an attacker can steal this token with a one-line script. Tokens stored here are also visible in browser DevTools.`,
                remediation: "Store authentication tokens in HttpOnly cookies (not accessible from JavaScript). If you must use storage, use sessionStorage and accept the reduced security, but never store long-lived tokens client-side.",
                aiSuggestion: `VULNERABLE LINE (line ${storageHit.idx + 1}):\n  ${storageHit.trimmed}\n  ${"^".repeat(Math.min(storageHit.trimmed.length, 60))}\n  ↑ token accessible to any script on the page — XSS = full account takeover\n\nFIXED — use HttpOnly cookie (server sets it):\n  // BEFORE (vulnerable — token accessible to JavaScript):\n  ${storageHit.trimmed}\n\n  // AFTER — have the server set an HttpOnly cookie instead:\n  // Server response header: Set-Cookie: auth_token=<value>; HttpOnly; Secure; SameSite=Strict\n  // Browser stores it automatically; JavaScript cannot read it`,
                line: storageHit.idx + 1,
              });
            }

            // ── 14. JS/TS: CORS wildcard ─────────────────────────────────────
            const corsHit = scan(/Access-Control-Allow-Origin['":\s]*\*/) ||
                           scan(/cors\s*\(\s*\{[^}]*origin\s*:\s*['"`]\*['"`]/);
            if (corsHit) {
              detectedIssues.push({
                title: "Overly Permissive CORS — Access-Control-Allow-Origin: *",
                severity: "MEDIUM", cwe: "942", category: "Code Security",
                description: `Line ${corsHit.idx + 1}: \`${corsHit.trimmed}\`\n\nSetting Access-Control-Allow-Origin to * allows any website on the internet to make cross-origin requests to this API. Combined with the user's active session cookies or tokens, a malicious website can silently call your API on behalf of logged-in users and read the responses.`,
                remediation: "Restrict CORS to specific trusted origins. Maintain an allowlist and validate the Origin header against it.",
                aiSuggestion: `VULNERABLE LINE (line ${corsHit.idx + 1}):\n  ${corsHit.trimmed}\n  ${"^".repeat(Math.min(corsHit.trimmed.length, 60))}\n  ↑ any origin can call this API and read responses\n\nFIXED — allowlist specific origins:\n  // BEFORE (dangerous — allows all origins):\n  ${corsHit.trimmed}\n\n  // AFTER (safe — allowlist):\n  const allowedOrigins = ['https://yourdomain.com', 'https://app.yourdomain.com'];\n  app.use(cors({\n    origin: (origin, callback) => {\n      if (!origin || allowedOrigins.includes(origin)) callback(null, true);\n      else callback(new Error('Not allowed by CORS'));\n    },\n    credentials: true,\n  }));`,
                line: corsHit.idx + 1,
              });
            }

            // ── 15. JS/TS: dangerouslySetInnerHTML (React-specific XSS) ──────
            const dangerHit = scan(/dangerouslySetInnerHTML\s*=\s*\{\s*\{/);
            if (dangerHit && !xssHit) {
              detectedIssues.push({
                title: "XSS Risk — dangerouslySetInnerHTML with Unvalidated Content",
                severity: "HIGH", cwe: "79", category: "Code Security",
                description: `Line ${dangerHit.idx + 1}: \`${dangerHit.trimmed}\`\n\nReact's dangerouslySetInnerHTML bypasses React's XSS protections and sets raw HTML directly. If __html is derived from user input, an API response, or any untrusted source, an attacker can inject <script> tags or onerror attributes to execute JavaScript in the victim's browser.`,
                remediation: "Sanitize the HTML string with DOMPurify.sanitize() before passing it to dangerouslySetInnerHTML. Never pass raw user input.",
                aiSuggestion: `VULNERABLE LINE (line ${dangerHit.idx + 1}):\n  ${dangerHit.trimmed}\n  ${"^".repeat(Math.min(dangerHit.trimmed.length, 60))}\n  ↑ raw HTML injected — attacker can embed <script>alert(1)</script>\n\nFIXED — sanitize before render:\n  // BEFORE (dangerous):\n  ${dangerHit.trimmed}\n\n  // AFTER (safe — DOMPurify strips dangerous tags):\n  import DOMPurify from 'dompurify';\n  <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userHtml) }} />`,
                line: dangerHit.idx + 1,
              });
            }
          }

          // ── 16. Universal: Missing authentication check ───────────────────
          const noAuthHit = scan(/app\.(get|post|put|delete|patch)\s*\(\s*['"`][^'"` ]+['"`]\s*,\s*(?:async\s*)?\(req/i);
          const hasAuthMiddleware = /requireAuth|authenticate|isAuthenticated|verifyToken|passport\.authenticate|@login_required|@require_login|middleware.*auth/i.test(code);
          if (noAuthHit && !hasAuthMiddleware && /user|account|admin|profile|order|payment/i.test(code)) {
            detectedIssues.push({
              title: "Missing Authentication Middleware on Sensitive Route",
              severity: "HIGH", cwe: "306", category: "Code Security",
              description: `Line ${noAuthHit.idx + 1}: \`${noAuthHit.trimmed}\`\n\nThis route handler accesses user, account, or payment data but no authentication middleware was detected in the code. Without authentication checks, unauthenticated users can access protected resources — OWASP A01: Broken Access Control.`,
              remediation: "Add authentication middleware before the route handler. Verify the session or JWT token and reject requests that are not authenticated.",
              aiSuggestion: `VULNERABLE LINE (line ${noAuthHit.idx + 1}):\n  ${noAuthHit.trimmed}\n  ${"^".repeat(Math.min(noAuthHit.trimmed.length, 60))}\n  ↑ no auth check — any anonymous request reaches this handler\n\nFIXED — add authentication middleware:\n  // BEFORE (open to unauthenticated access):\n  ${noAuthHit.trimmed}\n\n  // AFTER (require authenticated session first):\n  app.get('/api/profile', requireAuth, async (req, res) => {\n    // requireAuth middleware verifies JWT/session and rejects if invalid\n  });`,
              line: noAuthHit.idx + 1,
            });
          }
        }

        if (enableHygiene !== false) {
          // ── JS/TS only: var usage (prefer let/const) ──────────────────────
          if (!isPy && /\bvar\s+\w+/.test(code)) {
            const varLine = codeLines.findIndex((l: string) => /\bvar\s+/.test(l));
            detectedIssues.push({
              title: "Outdated Variable Declaration (var)",
              severity: "LOW", cwe: "1164", category: "Code Hygiene",
              description: `Line ${varLine + 1}: \`${codeLines[varLine]?.trim()}\`\n\nvar has function scope and hoisting behaviour that can lead to subtle bugs — variables declared inside blocks (if/for/while) are visible outside them. Modern JavaScript always uses let (mutable) or const (immutable) instead.`,
              remediation: "Replace var with const for immutable bindings or let for mutable ones.",
              aiSuggestion: `BEFORE (line ${varLine + 1}):\n  ${codeLines[varLine]?.trim()}\n\nAFTER:\n  ${codeLines[varLine]?.trim().replace(/\bvar\b/, "const")}`,
              line: varLine + 1,
            });
          }

          // ── JS/TS: Empty catch block ───────────────────────────────────────
          if (!isPy && /catch\s*\(\w+\)\s*\{\s*\}/.test(code)) {
            const catchLine = codeLines.findIndex((l: string) => /catch\s*\(/.test(l));
            detectedIssues.push({
              title: "Empty Catch Block — Exception Silently Swallowed",
              severity: "MEDIUM", cwe: "390", category: "Code Hygiene",
              description: `Line ${catchLine + 1}: \`${codeLines[catchLine]?.trim()}\`\n\nAn empty catch block discards the exception entirely. Errors disappear silently, making production bugs nearly impossible to diagnose. The program continues as if nothing went wrong, often corrupting state further downstream.`,
              remediation: "At minimum log the error. Ideally handle it gracefully or rethrow if the situation is unrecoverable.",
              aiSuggestion: `BEFORE (line ${catchLine + 1} — error swallowed silently):\n  ${codeLines[catchLine]?.trim()} {}\n\nAFTER (log and rethrow):\n  ${codeLines[catchLine]?.trim()} {\n    console.error('Unexpected error:', err);\n    throw err;  // let the caller decide recovery\n  }`,
              line: catchLine + 1,
            });
          }

          // ── Python: Bare except — catches everything including KeyboardInterrupt
          if (isPy) {
            const bareExceptIdx = codeLines.findIndex((l: string) => /^\s*except\s*:/.test(l));
            if (bareExceptIdx >= 0) {
              detectedIssues.push({
                title: "Bare except: Clause — Catches All Exceptions Including System Exits",
                severity: "MEDIUM", cwe: "390", category: "Code Hygiene",
                description: `Line ${bareExceptIdx + 1}: \`${codeLines[bareExceptIdx]?.trim()}\`\n\nA bare \`except:\` with no exception type catches every exception — including KeyboardInterrupt (Ctrl+C), SystemExit, and GeneratorExit. This makes it impossible to stop the program cleanly, hides bugs by silencing every error, and masks fatal conditions that should propagate. It is considered a major anti-pattern in Python.`,
                remediation: "Specify the exact exception type(s) you expect. Use 'except Exception:' at the broadest to at least exclude system-level signals.",
                aiSuggestion: `BEFORE (line ${bareExceptIdx + 1} — catches absolutely everything):\n  ${codeLines[bareExceptIdx]?.trim()}\n\nAFTER (specify the exception type):\n  except ValueError as e:          # only what you actually expect\n      print(f"Bad value: {e}")\n\n  # Or at minimum:\n  except Exception as e:            # excludes KeyboardInterrupt/SystemExit\n      logging.error("Unexpected error", exc_info=True)\n      raise                         # re-raise so callers are aware`,
                line: bareExceptIdx + 1,
              });
            }

            // ── Python: Empty except body (only pass) ─────────────────────
            for (let i = 0; i < codeLines.length - 1; i++) {
              if (/^\s*except/.test(codeLines[i]) && /^\s*pass\s*$/.test(codeLines[i + 1])) {
                detectedIssues.push({
                  title: "Empty except Block — Exception Silently Ignored",
                  severity: "MEDIUM", cwe: "390", category: "Code Hygiene",
                  description: `Line ${i + 1}: \`${codeLines[i]?.trim()}\` followed by \`pass\`\n\nThe except block catches an exception and immediately discards it with \`pass\`. Any error that occurs inside the try block will be completely invisible — no logging, no user feedback, no crash. Silent failures are the hardest bugs to diagnose.`,
                  remediation: "Log the exception at minimum. Use 'raise' to propagate it, or handle it specifically with meaningful fallback logic.",
                  aiSuggestion: `BEFORE (line ${i + 1} — exception swallowed silently):\n  ${codeLines[i]?.trim()}\n      pass\n\nAFTER (log and handle or re-raise):\n  ${codeLines[i]?.trim().replace(/^except/, "except Exception as e") || "except Exception as e:"}\n      logging.error("Error occurred: %s", e, exc_info=True)\n      raise  # or return a sensible fallback value`,
                  line: i + 1,
                });
                break;
              }
            }

            // ── Python: Mutable default argument in function definition ────
            const mutableDefaultIdx = codeLines.findIndex((l: string) =>
              /def\s+\w+\s*\(.*=\s*(\[\]|\{\}|\[\s*\]|\{\s*\})/.test(l)
            );
            if (mutableDefaultIdx >= 0) {
              detectedIssues.push({
                title: "Mutable Default Argument — Shared State Across Calls",
                severity: "MEDIUM", cwe: "1108", category: "Code Hygiene",
                description: `Line ${mutableDefaultIdx + 1}: \`${codeLines[mutableDefaultIdx]?.trim()}\`\n\nDefault argument values in Python are evaluated ONCE when the function is defined, not each time it is called. A mutable default (list or dict) is shared across all calls that don't provide that argument. Appending to it in one call modifies what the next call sees — a classic Python gotcha that causes state leakage between independent calls.`,
                remediation: "Use None as the default and create a new list/dict inside the function body.",
                aiSuggestion: `BEFORE (line ${mutableDefaultIdx + 1} — shared mutable state):\n  ${codeLines[mutableDefaultIdx]?.trim()}\n\nAFTER (use None sentinel):\n  ${codeLines[mutableDefaultIdx]?.trim().replace(/=\s*\[\]/, "=None").replace(/=\s*\{\}/, "=None")}\n      if items is None:\n          items = []   # new list created fresh for every call`,
                line: mutableDefaultIdx + 1,
              });
            }

            // ── Python: Global variable mutation inside function ───────────
            const globalIdx = codeLines.findIndex((l: string) => /^\s*global\s+\w+/.test(l));
            if (globalIdx >= 0) {
              detectedIssues.push({
                title: "Global Variable Modified Inside Function",
                severity: "LOW", cwe: "1108", category: "Code Hygiene",
                description: `Line ${globalIdx + 1}: \`${codeLines[globalIdx]?.trim()}\`\n\nUsing the \`global\` keyword allows a function to modify a module-level variable. This creates hidden coupling between functions — any function can change shared state at any time, making code hard to reason about, test, and debug. It also breaks thread safety.`,
                remediation: "Pass the value as a parameter and return the modified value instead of using global state.",
                aiSuggestion: `BEFORE (line ${globalIdx + 1} — modifies global state):\n  ${codeLines[globalIdx]?.trim()}\n\nAFTER (pass and return instead):\n  # Instead of modifying a global, pass the value in and return the new value:\n  def process(count):          # receive state as parameter\n      count += 1\n      return count             # return new value\n  count = process(count)       # caller manages state explicitly`,
                line: globalIdx + 1,
              });
            }
          }

          // ── TODO/FIXME comments — works for both JS (//) and Python (#) ──
          const todoLine = codeLines.findIndex((l: string) =>
            /\/\/\s*TODO|\/\/\s*FIXME|\/\/\s*HACK|#\s*TODO|#\s*FIXME|#\s*HACK/i.test(l)
          );
          if (todoLine >= 0) {
            detectedIssues.push({
              title: "Unresolved TODO / FIXME Comment",
              severity: "LOW", cwe: "1059", category: "Code Hygiene",
              description: `Line ${todoLine + 1}: \`${codeLines[todoLine]?.trim()}\`\n\nTODO and FIXME comments indicate intentionally incomplete or broken code. If merged into main and deployed, they represent known defects in production. They also accumulate over time, becoming permanent comments that no one ever acts on.`,
              remediation: "Resolve the item before merging, or create a tracked issue in your project management tool and reference the ticket number in the comment.",
              aiSuggestion: isPy
                ? `BEFORE (line ${todoLine + 1}):\n  ${codeLines[todoLine]?.trim()}\n\nAFTER (resolve or track):\n  # Option 1: implement it now\n  validate_input(data)   # implemented\n\n  # Option 2: create a ticket and reference it\n  # TODO(JIRA-1234): validate input before processing`
                : `BEFORE (line ${todoLine + 1}):\n  ${codeLines[todoLine]?.trim()}\n\nAFTER (resolve or track):\n  // Option 1: implement it now\n  if (!isValid(input)) throw new Error('Invalid input');\n\n  // Option 2: create a ticket and reference it\n  // TODO(JIRA-1234): validate input before processing`,
              line: todoLine + 1,
            });
          }
        }

        if (enableBestPractices !== false) {
          // No error handling on async
          if (/await\s+\w+/.test(code) && !/try\s*\{/.test(code)) {
            detectedIssues.push({
              title: "Unhandled Async Operation",
              severity: "MEDIUM", cwe: "391", category: "Code Quality",
              description: "Awaited promises without try/catch blocks can result in unhandled promise rejections that crash the application.",
              remediation: "Wrap await expressions in try/catch or attach .catch() handlers.",
              aiSuggestion: "BEFORE:\n  const data = await fetchData();\n\nAFTER:\n  try {\n    const data = await fetchData();\n  } catch (error) {\n    logger.error('Failed to fetch:', error);\n  }",
              line: codeLines.findIndex((l: string) => /await\s+/.test(l)) + 1 || 1,
            });
          }
          // Very long functions (>50 lines)
          if (lineCount > 50) {
            detectedIssues.push({
              title: "Large Code Block",
              severity: "LOW", cwe: "1121", category: "Code Quality",
              description: `The pasted code is ${lineCount} lines long. Functions or modules this large are harder to test, review, and maintain.`,
              remediation: "Break large code blocks into smaller, single-responsibility functions or modules.",
              aiSuggestion: "Identify logical sub-tasks within the code and extract each into its own named function. Aim for functions under 30 lines.",
              line: 1,
            });
          }
          // Missing type annotations in TypeScript
          if ((language === "typescript") && /function\s+\w+\s*\([^:)]*\)\s*\{/.test(code)) {
            detectedIssues.push({
              title: "Missing Return Type Annotation",
              severity: "LOW", cwe: "843", category: "Code Quality",
              description: "Functions without explicit return type annotations reduce TypeScript's ability to catch type errors.",
              remediation: "Add explicit return type annotations to all function declarations.",
              aiSuggestion: "BEFORE:\n  function processUser(user) {\n    return user.name;\n  }\n\nAFTER:\n  function processUser(user: User): string {\n    return user.name;\n  }",
              line: codeLines.findIndex((l: string) => /function\s+\w+\s*\(/.test(l)) + 1 || 1,
            });
          }
        }

        // ── Python-specific runtime error detection ──────────────────────────
        if (effectiveLang === "python") {
          // 1. Wrong / misspelled standard library module names
          const moduleTypos: { wrong: string; correct: string }[] = [
            { wrong: "maths",    correct: "math"    },
            { wrong: "Math",     correct: "math"    },
            { wrong: "Maths",    correct: "math"    },
            { wrong: "mathlib",  correct: "math"    },
            { wrong: "panda",    correct: "pandas"  },
            { wrong: "numpys",   correct: "numpy"   },
            { wrong: "datetime2",correct: "datetime"},
            { wrong: "strings",  correct: "string"  },
            { wrong: "jsons",    correct: "json"    },
            { wrong: "re2",      correct: "re"      },
            { wrong: "oss",      correct: "os"      },
            { wrong: "sys2",     correct: "sys"     },
          ];
          for (const mod of moduleTypos) {
            const li = codeLines.findIndex(
              (l: string) => new RegExp(`\\bimport\\s+${mod.wrong}\\b|\\bfrom\\s+${mod.wrong}\\b`).test(l)
            );
            if (li >= 0) {
              detectedIssues.push({
                title: `ModuleNotFoundError: 'import ${mod.wrong}'`,
                severity: "CRITICAL", cwe: "1228", category: "Code Hygiene",
                description: `Line ${li + 1}: 'import ${mod.wrong}' will raise a ModuleNotFoundError at runtime because '${mod.wrong}' is not a valid Python module. The correct module name is '${mod.correct}'.`,
                remediation: `Replace 'import ${mod.wrong}' with 'import ${mod.correct}'.`,
                aiSuggestion: `BEFORE:\n  import ${mod.wrong}\n  result = ${mod.wrong}.sqrt(16)  # NameError too\n\nAFTER:\n  import ${mod.correct}\n  result = ${mod.correct}.sqrt(16)`,
                line: li + 1,
              });
            }
          }

          // 2. Missing colon at the end of control-flow / definition lines
          // NOTE: no break — we report every occurrence so all errors are visible
          for (let i = 0; i < codeLines.length; i++) {
            const raw = codeLines[i];
            const trimmed = raw.trimEnd();
            const content = trimmed.trim();
            if (
              /^\s*(for|if|elif|else|while|def|class|with|try|except|finally)\b/.test(raw) &&
              content.length > 0 &&
              !trimmed.endsWith(":") &&
              !trimmed.endsWith("\\") &&
              !trimmed.endsWith(",") &&
              !content.startsWith("#") &&
              // skip lines where def/for/if span is still open (unclosed parens/brackets)
              !(/^\s*def\s+\w+\s*\([^)]*$/.test(raw)) &&
              !(/^\s*(for|if|elif|while)\s+.*\([^)]*$/.test(raw))
            ) {
              const keyword = (content.match(/^(for|if|elif|else|while|def|class|with|try|except|finally)\b/) || [])[1];
              detectedIssues.push({
                title: `SyntaxError: Missing Colon on '${keyword}' Statement`,
                severity: "CRITICAL", cwe: "710", category: "Code Hygiene",
                description: `Line ${i + 1}: '${content}' — Python requires a colon ':' at the end of every ${keyword} statement. Without it, Python raises a SyntaxError and the entire program refuses to run.`,
                remediation: `Add a colon at the end: '${content}:'`,
                aiSuggestion: `BEFORE:\n  ${content}\n      body()  # SyntaxError before here\n\nAFTER:\n  ${content}:\n      body()`,
                line: i + 1,
              });
            }
          }

          // 2b. Incomplete function definition — missing closing ')' before colon
          for (let i = 0; i < codeLines.length; i++) {
            const raw = codeLines[i];
            if (/^\s*def\s+\w+\s*\([^)]*$/.test(raw) && !raw.trimEnd().endsWith("\\")) {
              const content = raw.trim();
              detectedIssues.push({
                title: `SyntaxError: Incomplete Function Definition — Missing Closing ')'`,
                severity: "CRITICAL", cwe: "710", category: "Code Hygiene",
                description: `Line ${i + 1}: '${content}' — The function definition opens a parenthesis '(' but never closes it. Python cannot parse the function signature, raising a SyntaxError.`,
                remediation: `Close the parenthesis and add a colon: '${content}):'`,
                aiSuggestion: `BEFORE:\n  ${content}   # SyntaxError: missing ')' and ':'\n\nAFTER:\n  ${content}):`,
                line: i + 1,
              });
            }
          }

          // 2c. Unclosed list comprehension — missing closing ']'
          for (let i = 0; i < codeLines.length; i++) {
            const raw = codeLines[i];
            // Line contains '= [' and a 'for' keyword and does NOT end with ']'
            if (/^\s*\w+\s*=\s*\[/.test(raw) && /\bfor\b/.test(raw) && !raw.trimEnd().endsWith("]")) {
              const content = raw.trim();
              detectedIssues.push({
                title: `SyntaxError: Unclosed List Comprehension — Missing ']'`,
                severity: "CRITICAL", cwe: "710", category: "Code Hygiene",
                description: `Line ${i + 1}: '${content}' — The list comprehension starts with '[' but the closing ']' is missing. Python raises a SyntaxError because the expression is incomplete.`,
                remediation: `Add the closing bracket: '${content}]'`,
                aiSuggestion: `BEFORE:\n  ${content}   # SyntaxError\n\nAFTER:\n  ${content}]`,
                line: i + 1,
              });
            }
          }

          // 2d. Unclosed dictionary literal — more '{' than '}'
          {
            let braceBalance = 0;
            let firstOpenLine = -1;
            for (let i = 0; i < codeLines.length; i++) {
              const c = codeLines[i];
              if (c.trim().startsWith("#")) continue;
              for (const ch of c) {
                if (ch === "{") { if (braceBalance === 0) firstOpenLine = i; braceBalance++; }
                if (ch === "}") braceBalance--;
              }
            }
            if (braceBalance > 0 && firstOpenLine >= 0) {
              const content = codeLines[firstOpenLine].trim();
              detectedIssues.push({
                title: `SyntaxError: Unclosed Dictionary Literal — Missing '}'`,
                severity: "CRITICAL", cwe: "710", category: "Code Hygiene",
                description: `Line ${firstOpenLine + 1}: '${content}' — A dictionary literal is opened with '{' but never closed with '}'. Python raises a SyntaxError because the block is never terminated.`,
                remediation: `Add the closing brace '}' after the last key-value pair.`,
                aiSuggestion: `BEFORE:\n  ${content}   # dictionary never closed\n      ...\n\nAFTER:\n  ${content}\n      ...\n  }`,
                line: firstOpenLine + 1,
              });
            }
          }

          // 3. Assignment (=) used instead of equality (==) inside if/elif/while condition
          for (let i = 0; i < codeLines.length; i++) {
            const line = codeLines[i];
            if (/\b(if|elif|while)\s+\w[\w.]*\s*=[^=!<>]/.test(line) &&
                !/[=!<>]=[^=]/.test(line.replace(/==|!=|<=|>=/g, ""))) {
              const content = line.trim();
              detectedIssues.push({
                title: `SyntaxError: Assignment '=' Inside Condition (use '==')`,
                severity: "CRITICAL", cwe: "480", category: "Code Hygiene",
                description: `Line ${i + 1}: '${content}' — A single '=' is an assignment operator, not a comparison. Python raises a SyntaxError when an assignment appears inside an if/elif/while condition. Use '==' for equality checks.`,
                remediation: "Replace '=' with '==' in the condition to compare instead of assign.",
                aiSuggestion: `BEFORE:\n  if number = 10:      # SyntaxError\n      print("ten")\n\nAFTER:\n  if number == 10:     # equality comparison\n      print("ten")`,
                line: i + 1,
              });
            }
          }

          // 4. String literal + numeric-named variable without str() conversion (TypeError)
          // Also catches adjacent string + variable without ANY operator (SyntaxError)
          const numericVarPattern = /(?:result|count|total|num|number|value|score|age|amount|price|qty|quantity|sum|avg|average|max|min|index|idx|diff|delta|rate|ratio|percent)/i;
          for (let i = 0; i < codeLines.length; i++) {
            const line = codeLines[i];
            // Case A: string + var or var + string with '+' (TypeError if int)
            const strPlusVar = /["']\s*\+\s*(\w+)/.exec(line);
            const varPlusStr = /(\w+)\s*\+\s*["']/.exec(line);
            const plusMatch = strPlusVar || varPlusStr;
            if (plusMatch && !line.includes("str(") && !line.includes("f\"") && !line.includes("f'")) {
              const varName = plusMatch[1];
              if (numericVarPattern.test(varName)) {
                detectedIssues.push({
                  title: `TypeError: Cannot Concatenate str + ${varName} (non-string)`,
                  severity: "HIGH", cwe: "704", category: "Code Hygiene",
                  description: `Line ${i + 1}: '${line.trim()}' — Python's '+' operator does not auto-convert types. If '${varName}' is an integer or float, concatenating it with a string literal raises: TypeError: can only concatenate str (not "int") to str.`,
                  remediation: "Wrap the numeric variable in str(), use an f-string, or pass both values as separate arguments to print().",
                  aiSuggestion: `BEFORE:\n  print("Result is" + ${varName})   # TypeError if ${varName} is int\n\nAFTER (f-string):\n  print(f"Result is {${varName}}")\n\nAFTER (str conversion):\n  print("Result is " + str(${varName}))\n\nAFTER (comma):\n  print("Result is", ${varName})`,
                  line: i + 1,
                });
              }
            }
            // Case B: adjacent string + variable with NO operator — missing comma/+
            const adjacentMatch = /["']\s+([a-zA-Z_]\w*)(?=\s*[,)])/.exec(line);
            if (adjacentMatch && !plusMatch && !line.includes("str(") && !line.includes("f\"") && !line.includes("f'")) {
              const varName = adjacentMatch[1];
              // Exclude cases where the identifier is a keyword or closing delimiter
              if (!/^(and|or|not|in|is|if|else|for|while|True|False|None)$/.test(varName)) {
                detectedIssues.push({
                  title: `SyntaxError: Missing Operator Between String and '${varName}'`,
                  severity: "CRITICAL", cwe: "710", category: "Code Hygiene",
                  description: `Line ${i + 1}: '${line.trim()}' — A string literal is placed directly next to '${varName}' with only whitespace between them. Python treats two adjacent string literals as one concatenated string, but a string next to a variable name is a SyntaxError. Add a comma ',' or '+' between them.`,
                  remediation: `Add a comma to pass as separate arguments: print("...", ${varName}) — or use f-string: print(f"... {${varName}}")`,
                  aiSuggestion: `BEFORE:\n  ${line.trim()}   # SyntaxError\n\nAFTER (comma — recommended for print):\n  print("Average age is:", ${varName})\n\nAFTER (f-string):\n  print(f"Average age is: {${varName}}")`,
                  line: i + 1,
                });
              }
            }
          }

          // 5. Function call argument count mismatch (compare def params vs call args)
          type FuncDef = { name: string; paramCount: number; line: number };
          const funcDefs: FuncDef[] = [];
          for (let i = 0; i < codeLines.length; i++) {
            const m = codeLines[i].match(/^\s*def\s+(\w+)\s*\(([^)]*)\)/);
            if (m) {
              const rawParams = m[2];
              const params = rawParams
                .split(",")
                .map((p: string) => p.trim())
                .filter((p: string) => p && p !== "self" && p !== "cls" && !p.startsWith("*") && !p.startsWith("**") && !p.includes("="));
              funcDefs.push({ name: m[1], paramCount: params.length, line: i + 1 });
            }
          }
          for (const fd of funcDefs) {
            for (let i = 0; i < codeLines.length; i++) {
              if (codeLines[i].trim().startsWith("def ")) continue;
              const callRx = new RegExp(`\\b${fd.name}\\s*\\(([^)]*)\\)`);
              const cm = codeLines[i].match(callRx);
              if (cm) {
                const rawArgs = cm[1].trim();
                const argCount = rawArgs === "" ? 0 : rawArgs.split(",").length;
                if (argCount !== fd.paramCount) {
                  detectedIssues.push({
                    title: `TypeError: ${fd.name}() — Wrong Argument Count (${argCount} given, ${fd.paramCount} expected)`,
                    severity: "CRITICAL", cwe: "628", category: "Code Hygiene",
                    description: `Line ${i + 1}: '${codeLines[i].trim()}' — '${fd.name}()' is defined at line ${fd.line} with ${fd.paramCount} required positional parameter${fd.paramCount !== 1 ? "s" : ""}. It is called here with ${argCount} argument${argCount !== 1 ? "s" : ""}, which raises: TypeError: ${fd.name}() missing ${Math.abs(fd.paramCount - argCount)} required positional argument${Math.abs(fd.paramCount - argCount) !== 1 ? "s" : ""}.`,
                    remediation: `Provide exactly ${fd.paramCount} argument${fd.paramCount !== 1 ? "s" : ""} when calling '${fd.name}()'.`,
                    aiSuggestion: `# Function defined at line ${fd.line}:\ndef ${fd.name}(${Array.from({ length: fd.paramCount }, (_, j) => `param${j + 1}`).join(", ")}):\n    ...\n\n# BEFORE (wrong):\n${codeLines[i].trim()}   # TypeError\n\n# AFTER (correct):\n${fd.name}(${Array.from({ length: fd.paramCount }, (_, j) => `value${j + 1}`).join(", ")})`,
                    line: i + 1,
                  });
                }
              }
            }
          }

          // 6. List index out of range (static analysis: compare literal list size vs access index)
          type ListDef = { name: string; length: number; line: number };
          const listDefs: ListDef[] = [];
          for (let i = 0; i < codeLines.length; i++) {
            const m = codeLines[i].match(/^\s*(\w+)\s*=\s*\[(.*)\]\s*$/);
            if (m) {
              const inner = m[2].trim();
              const elems = inner === "" ? 0 : inner.split(",").filter((e: string) => e.trim() !== "").length;
              listDefs.push({ name: m[1], length: elems, line: i + 1 });
            }
          }
          for (const ld of listDefs) {
            for (let i = 0; i < codeLines.length; i++) {
              const accessRx = new RegExp(`\\b${ld.name}\\s*\\[(\\d+)\\]`);
              const am = codeLines[i].match(accessRx);
              if (am) {
                const idx = parseInt(am[1], 10);
                if (idx >= ld.length) {
                  detectedIssues.push({
                    title: `IndexError: ${ld.name}[${idx}] — List Index Out of Range`,
                    severity: "CRITICAL", cwe: "129", category: "Code Hygiene",
                    description: `Line ${i + 1}: '${codeLines[i].trim()}' — The list '${ld.name}' is defined at line ${ld.line} with ${ld.length} element${ld.length !== 1 ? "s" : ""} (valid indices: 0–${ld.length - 1}). Accessing index ${idx} exceeds the list bounds and raises: IndexError: list index out of range.`,
                    remediation: `Use an index between 0 and ${ld.length - 1}, or add a length check before accessing the element.`,
                    aiSuggestion: `BEFORE:\n  ${ld.name} = [...]  # ${ld.length} element${ld.length !== 1 ? "s" : ""}\n  print(${ld.name}[${idx}])  # IndexError!\n\nAFTER (safe access):\n  if ${idx} < len(${ld.name}):\n      print(${ld.name}[${idx}])\n  else:\n      print(f"Index ${idx} out of range for ${ld.name} (len={len(${ld.name})})")\n\nAFTER (use valid index):\n  print(${ld.name}[${ld.length - 1}])  # last element`,
                    line: i + 1,
                  });
                }
              }
            }
          }
        }
        // ── End Python-specific checks ────────────────────────────────────────

        // If no issues were auto-detected from the code, add a generic structural observation
        if (detectedIssues.length === 0) {
          detectedIssues.push({
            title: "Code Review Recommended",
            severity: "LOW", cwe: "1059", category: "Code Quality",
            description: "No obvious high-severity patterns were detected. A manual code review is still recommended for logic errors and business-specific vulnerabilities.",
            remediation: "Conduct a peer code review focusing on business logic, edge cases, and error handling.",
            aiSuggestion: "Review the code against OWASP Top 10 for web applications and apply language-specific secure coding guidelines.",
            line: 1,
          });
        }

        let securityCount = 0, hygieneCount = 0, bestPracticeCount = 0;

        for (const issue of detectedIssues) {
          await storage.createFinding({
            userId: scan.userId,
            title: issue.title,
            description: issue.description,
            severity: issue.severity,
            category: issue.category,
            asset: displayFile,
            cwe: issue.cwe,
            detected: new Date().toISOString(),
            status: "open",
            location: `${displayFile}:${issue.line}`,
            remediation: issue.remediation,
            aiSuggestion: issue.aiSuggestion,
            riskScore: issue.severity === "CRITICAL" ? 90 + Math.floor(Math.random() * 8) :
                       issue.severity === "HIGH" ? 72 + Math.floor(Math.random() * 15) :
                       issue.severity === "MEDIUM" ? 48 + Math.floor(Math.random() * 20) :
                       Math.floor(Math.random() * 25) + 15,
            source: "linter-scan",
            linterScanId: scan.id,
            scanId: scan.id,
            scanType: "linter",
          });
          if (issue.category === "Code Security") securityCount++;
          else if (issue.category === "Code Hygiene") hygieneCount++;
          else bestPracticeCount++;
        }

        await storage.updateLinterScan(scan.id, scan.userId, {
          scanStatus: "completed",
          scannedAt: new Date(),
          issuesCount: detectedIssues.length,
          securityIssuesCount: securityCount,
          hygieneIssuesCount: hygieneCount,
          bestPracticeIssuesCount: bestPracticeCount,
        });

        await notifyScanComplete(storage, scan.userId, scan.id, "linter", "Code Snippet", detectedIssues.length);
      }, 3000);

    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Specific files scan — scan selected files within a folder
  app.post("/api/linter-scans/specific-files", requireAuth, async (req: any, res) => {
    try {
      const { folderPath, filePaths, fileContents, projectName, language, enableSecurity, enableHygiene, enableBestPractices } = req.body;
      if (!filePaths || !projectName || !language) {
        return res.status(400).json({ message: "filePaths, projectName, and language are required" });
      }

      const paths: string[] = Array.isArray(filePaths)
        ? filePaths
        : String(filePaths).split("\n").map((l: string) => l.trim()).filter(Boolean);

      if (paths.length === 0) {
        return res.status(400).json({ message: "At least one file path is required" });
      }

      // fileContents: Record<filename, code> — provided when user uploads real files
      const uploadedContents: Record<string, string> = fileContents || {};
      const hasRealContent = Object.keys(uploadedContents).length > 0;

      const scan = await storage.createLinterScan({
        userId: req.user.id,
        repositoryUrl: `files://${folderPath || paths[0]}`,
        projectName,
        language,
        scanStatus: "scanning",
      });

      res.status(201).json(scan);

      setTimeout(async () => {
        let totalCreated = 0, securityCount = 0, hygieneCount = 0, bestPracticeCount = 0;

        // Helper: analyze a code string for real vulnerability patterns (same logic as code-snippet endpoint)
        const analyzeCode = (code: string, displayFile: string) => {
          const codeLines = code.split("\n");
          const issues: Array<{ title: string; severity: string; cwe: string; category: string; description: string; remediation: string; aiSuggestion: string; line: number }> = [];

          if (enableSecurity !== false) {
            if (/\$\{.*\}.*(?:SELECT|INSERT|UPDATE|DELETE|FROM|WHERE)/i.test(code) || /(?:query|sql)\s*=\s*[`"'].*\+/i.test(code)) {
              issues.push({ title: "SQL Injection Risk", severity: "CRITICAL", cwe: "89", category: "Code Security",
                description: "String interpolation or concatenation in a SQL query is vulnerable to SQL injection.",
                remediation: "Use parameterized queries or prepared statements.",
                aiSuggestion: "BEFORE:\n  const q = `SELECT * FROM users WHERE id = ${id}`;\n\nAFTER:\n  const q = 'SELECT * FROM users WHERE id = ?';\n  db.query(q, [id]);",
                line: codeLines.findIndex((l: string) => /SELECT|INSERT|UPDATE|DELETE/i.test(l)) + 1 || 1 });
            }
            if (/(?:password|secret|api_key|apikey|token|auth)\s*[:=]\s*['"]\w{6,}/i.test(code)) {
              issues.push({ title: "Hardcoded Credential", severity: "CRITICAL", cwe: "798", category: "Code Security",
                description: "A hardcoded password, secret, or API key was detected. This is a critical security risk.",
                remediation: "Use environment variables or a secrets manager at runtime.",
                aiSuggestion: "BEFORE:\n  const apiKey = 'sk-abc123xyz';\n\nAFTER:\n  const apiKey = process.env.API_KEY;",
                line: codeLines.findIndex((l: string) => /password|secret|api_key|apikey|token|auth/i.test(l)) + 1 || 1 });
            }
            if (/\beval\s*\(/.test(code)) {
              issues.push({ title: "Dangerous eval() Usage", severity: "HIGH", cwe: "95", category: "Code Security",
                description: "eval() can allow remote code execution if the argument is derived from user input.",
                remediation: "Avoid eval(). Use JSON.parse() for data or safe alternatives.",
                aiSuggestion: "BEFORE:\n  const result = eval(userInput);\n\nAFTER:\n  const result = JSON.parse(userInput);",
                line: codeLines.findIndex((l: string) => /\beval\s*\(/.test(l)) + 1 || 1 });
            }
            if (/\.innerHTML\s*=/.test(code)) {
              issues.push({ title: "XSS via innerHTML", severity: "HIGH", cwe: "79", category: "Code Security",
                description: "Assigning to innerHTML with unvalidated content creates an XSS vulnerability.",
                remediation: "Use textContent or sanitize with DOMPurify.",
                aiSuggestion: "BEFORE:\n  el.innerHTML = userContent;\n\nAFTER:\n  el.textContent = userContent;",
                line: codeLines.findIndex((l: string) => /\.innerHTML\s*=/.test(l)) + 1 || 1 });
            }
            if (/console\.log\s*\(.*(?:password|token|secret|key)/i.test(code)) {
              issues.push({ title: "Sensitive Data in Logs", severity: "HIGH", cwe: "532", category: "Code Security",
                description: "Logging sensitive values exposes credentials in log files.",
                remediation: "Remove sensitive values from log statements.",
                aiSuggestion: "BEFORE:\n  console.log('Token:', authToken);\n\nAFTER:\n  console.log('Auth present:', !!authToken);",
                line: codeLines.findIndex((l: string) => /console\.log.*(?:password|token|secret|key)/i.test(l)) + 1 || 1 });
            }
          }
          if (enableHygiene !== false) {
            if (/\bvar\s+\w+/.test(code)) {
              issues.push({ title: "Outdated var Declaration", severity: "LOW", cwe: "1164", category: "Code Hygiene",
                description: "var has function scope and hoisting issues. Use let or const instead.",
                remediation: "Replace var with const or let.",
                aiSuggestion: "BEFORE:\n  var count = 0;\n\nAFTER:\n  let count = 0;",
                line: codeLines.findIndex((l: string) => /\bvar\s+/.test(l)) + 1 || 1 });
            }
            if (/catch\s*\(\w+\)\s*\{\s*\}/.test(code)) {
              issues.push({ title: "Empty Catch Block", severity: "MEDIUM", cwe: "390", category: "Code Hygiene",
                description: "Empty catch blocks silently swallow exceptions.",
                remediation: "At minimum, log the error or rethrow it.",
                aiSuggestion: "BEFORE:\n  } catch (err) {}\n\nAFTER:\n  } catch (err) {\n    console.error(err);\n  }",
                line: codeLines.findIndex((l: string) => /catch\s*\(/.test(l)) + 1 || 1 });
            }
            const todoLine = codeLines.findIndex((l: string) => /\/\/\s*(TODO|FIXME|HACK)/i.test(l));
            if (todoLine >= 0) {
              issues.push({ title: "Unresolved TODO Comment", severity: "LOW", cwe: "1059", category: "Code Hygiene",
                description: "TODO/FIXME comments indicate unfinished code.",
                remediation: "Resolve the TODO or create a tracked issue.",
                aiSuggestion: "BEFORE:\n  // TODO: validate input\n  process(input);\n\nAFTER:\n  if (!isValid(input)) throw new Error('Invalid');\n  process(input);",
                line: todoLine + 1 });
            }
          }
          if (enableBestPractices !== false) {
            if (/await\s+\w+/.test(code) && !/try\s*\{/.test(code)) {
              issues.push({ title: "Unhandled Async Operation", severity: "MEDIUM", cwe: "391", category: "Code Quality",
                description: "Awaited promises without try/catch can cause unhandled rejections.",
                remediation: "Wrap await in try/catch or add .catch() handlers.",
                aiSuggestion: "BEFORE:\n  const data = await fetchData();\n\nAFTER:\n  try {\n    const data = await fetchData();\n  } catch (err) { logger.error(err); }",
                line: codeLines.findIndex((l: string) => /await\s+/.test(l)) + 1 || 1 });
            }
            if (language === "typescript" && /function\s+\w+\s*\([^:)]*\)\s*\{/.test(code)) {
              issues.push({ title: "Missing Return Type Annotation", severity: "LOW", cwe: "843", category: "Code Quality",
                description: "Functions without explicit return types reduce TypeScript's type-checking ability.",
                remediation: "Add explicit return type annotations.",
                aiSuggestion: "BEFORE:\n  function process(user) { return user.name; }\n\nAFTER:\n  function process(user: User): string { return user.name; }",
                line: codeLines.findIndex((l: string) => /function\s+\w+\s*\(/.test(l)) + 1 || 1 });
            }
          }
          // Guarantee at least one finding per uploaded file
          if (issues.length === 0) {
            issues.push({ title: "Manual Review Recommended", severity: "LOW", cwe: "1059", category: "Code Quality",
              description: "No obvious high-severity patterns were auto-detected. A manual review is still recommended.",
              remediation: "Review against OWASP Top 10 and apply secure coding guidelines.",
              aiSuggestion: "Perform a peer review focusing on business logic, edge cases, and error handling.",
              line: 1 });
          }
          return issues;
        };

        for (const filePath of paths) {
          const code = uploadedContents[filePath]; // may be undefined if path was typed manually

          if (code) {
            // Real content available — run pattern analysis
            const issues = analyzeCode(code, filePath);
            for (const issue of issues) {
              await storage.createFinding({
                userId: scan.userId,
                title: issue.title,
                description: issue.description,
                severity: issue.severity,
                category: issue.category,
                asset: filePath,
                cwe: issue.cwe,
                detected: new Date().toISOString(),
                status: "open",
                location: `${filePath}:${issue.line}`,
                remediation: issue.remediation,
                aiSuggestion: issue.aiSuggestion,
                riskScore: issue.severity === "CRITICAL" ? 90 + Math.floor(Math.random() * 8) :
                           issue.severity === "HIGH" ? 72 + Math.floor(Math.random() * 15) :
                           issue.severity === "MEDIUM" ? 48 + Math.floor(Math.random() * 20) :
                           Math.floor(Math.random() * 25) + 12,
                source: "linter-scan",
                linterScanId: scan.id,
                scanId: scan.id,
                scanType: "linter",
              });
              totalCreated++;
              if (issue.category === "Code Security") securityCount++;
              else if (issue.category === "Code Hygiene") hygieneCount++;
              else bestPracticeCount++;
            }
          } else {
            // No content — use template-based simulation for manually typed paths
            const issueTemplates = [
              { enabled: enableSecurity !== false, type: "security", items: [
                { title: "Potential Path Traversal", severity: "HIGH", cwe: "22", category: "Code Security",
                  description: "File path constructed from user input may allow directory traversal attacks.",
                  remediation: "Validate all path components and verify the result stays within the expected directory.",
                  aiSuggestion: "BEFORE:\n  const file = path.join(baseDir, userInput);\n\nAFTER:\n  const resolved = path.resolve(baseDir, userInput);\n  if (!resolved.startsWith(baseDir)) throw new Error('Invalid path');" },
                { title: "Unvalidated File Extension", severity: "MEDIUM", cwe: "434", category: "Code Security",
                  description: "File operations may lack extension validation, allowing dangerous file types.",
                  remediation: "Whitelist allowed extensions and validate before processing.",
                  aiSuggestion: "BEFORE:\n  processFile(uploadedFile);\n\nAFTER:\n  const allowed = ['.jpg','.png'];\n  if (!allowed.includes(path.extname(uploadedFile))) throw new Error('Unsupported');" },
              ]},
              { enabled: enableHygiene !== false, type: "hygiene", items: [
                { title: "Unused Import", severity: "LOW", cwe: "563", category: "Code Hygiene",
                  description: "Imported module is never referenced, increasing bundle size unnecessarily.",
                  remediation: "Remove unused imports.",
                  aiSuggestion: "BEFORE:\n  import { unused } from './helpers';\n\nAFTER:\n  // Remove the unused import" },
              ]},
              { enabled: enableBestPractices !== false, type: "bestPractice", items: [
                { title: "Magic Number", severity: "LOW", cwe: "547", category: "Code Quality",
                  description: "Literal numeric values without named constants reduce readability.",
                  remediation: "Replace magic numbers with named constants.",
                  aiSuggestion: "BEFORE:\n  if (retries > 3) cancel();\n\nAFTER:\n  const MAX_RETRIES = 3;\n  if (retries > MAX_RETRIES) cancel();" },
              ]},
            ];
            const numIssues = Math.floor(Math.random() * 2) + 1;
            for (let i = 0; i < numIssues; i++) {
              const enabledGroups = issueTemplates.filter(g => g.enabled && g.items.length > 0);
              if (enabledGroups.length === 0) break;
              const group = enabledGroups[Math.floor(Math.random() * enabledGroups.length)];
              const template = group.items[Math.floor(Math.random() * group.items.length)];
              const lineNum = Math.floor(Math.random() * 80) + 1;
              await storage.createFinding({
                userId: scan.userId, title: template.title, description: template.description,
                severity: template.severity, category: template.category, asset: filePath,
                cwe: template.cwe, detected: new Date().toISOString(), status: "open",
                location: `${filePath}:${lineNum}`, remediation: template.remediation,
                aiSuggestion: template.aiSuggestion,
                riskScore: template.severity === "HIGH" ? 70 + Math.floor(Math.random() * 18) :
                           template.severity === "MEDIUM" ? 45 + Math.floor(Math.random() * 22) :
                           Math.floor(Math.random() * 28) + 12,
                source: "linter-scan", linterScanId: scan.id, scanId: scan.id, scanType: "linter",
              });
              totalCreated++;
              if (group.type === "security") securityCount++;
              else if (group.type === "hygiene") hygieneCount++;
              else bestPracticeCount++;
            }
          }
        }

        await storage.updateLinterScan(scan.id, scan.userId, {
          scanStatus: "completed",
          scannedAt: new Date(),
          issuesCount: totalCreated,
          securityIssuesCount: securityCount,
          hygieneIssuesCount: hygieneCount,
          bestPracticeIssuesCount: bestPracticeCount,
        });

        await notifyScanComplete(storage, scan.userId, scan.id, "linter", hasRealContent ? "Files (uploaded)" : "Specific Files", totalCreated);
      }, 4000);

    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Linter Fix Batch endpoints
  // Free single fix only - for "fix all", use the paid auto-fix-all endpoint
  app.post("/api/linter-scans/:id/fix", requireAuth, async (req: any, res) => {
    try {
      const { mode, findingId } = req.body;
      const scan = await storage.getLinterScan(req.params.id, req.user.id);
      
      if (!scan) {
        return res.status(404).json({ message: "Linter scan not found" });
      }

      // Enforce single fix only for free path - redirect to paid endpoint for batch fixes
      if (mode === 'all') {
        return res.status(400).json({ 
          message: "Batch 'fix all' requires payment. Use /auto-fix-all endpoint instead.",
          redirectTo: `/api/linter-scans/${req.params.id}/auto-fix-all`
        });
      }

      if (!findingId) {
        return res.status(400).json({ message: "findingId is required for single fix" });
      }

      // Create fix batch job (free path - single fix only)
      const batch = await storage.createLinterFixBatch({
        userId: req.user.id,
        linterScanId: req.params.id,
        mode: 'single',
        findingId,
        findingsToFix: 1,
        status: 'applying',
      });

      // Simulate fix application (3 seconds)
      setTimeout(async () => {
        try {
          await storage.updateLinterFixBatch(batch.id, req.user.id, {
            status: 'validating',
            progress: 50,
            findingsFixed: 1,
          });

          // Simulate validation (2 seconds)
          setTimeout(async () => {
            try {
              await storage.updateLinterFixBatch(batch.id, req.user.id, {
                status: 'completed',
                progress: 100,
                validationStatus: 'pass',
                uploadStatus: 'pending',
              });

              // Update scan with fix applied status
              await storage.updateLinterScan(req.params.id, req.user.id, {
                fixesApplied: true,
                lastValidationStatus: 'pass',
              });
            } catch (error) {
              console.error('[Linter Fix] Validation failed:', error);
              await storage.updateLinterFixBatch(batch.id, req.user.id, {
                status: 'failed',
                errorMessage: 'Validation failed',
              });
            }
          }, 2000);
        } catch (error) {
          console.error('[Linter Fix] Fix application failed:', error);
          await storage.updateLinterFixBatch(batch.id, req.user.id, {
            status: 'failed',
            errorMessage: 'Fix application failed',
          });
        }
      }, 3000);

      res.json(batch);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Generate fixed code output - applies all finding fixes to the original code
  app.get("/api/linter-scans/:id/fixed-code", requireAuth, async (req: any, res) => {
    try {
      const scan = await storage.getLinterScan(req.params.id, req.user.id);
      if (!scan) return res.status(404).json({ message: "Linter scan not found" });

      const originalCode = (scan as any).codeContent || null;
      const findings = await storage.getFindingsByScan(req.params.id, req.user.id, 'linter');

      // Parse AFTER block from each finding's aiSuggestion
      function extractFirstAfterBlock(suggestion: string): string | null {
        if (!suggestion) return null;
        // Match first AFTER block (handles both # and // comment styles)
        const m = suggestion.match(/(?:\/\/|#)\s*AFTER[^:\n]*:\n([\s\S]*?)(?=\n\s*(?:\/\/|#)\s*AFTER|\n\s*(?:\/\/|#)\s*[A-Z]|$)/i);
        return m ? m[1].replace(/^  /mg, '').trim() : null;
      }

      // Build per-finding fix data
      const fixes = findings.map((f: any) => {
        const after = extractFirstAfterBlock(f.aiSuggestion || '');
        const before = (() => {
          const m = (f.aiSuggestion || '').match(/(?:\/\/|#)\s*BEFORE[^:\n]*:\n([\s\S]*?)(?=\n\s*(?:\/\/|#))/i);
          return m ? m[1].replace(/^  /mg, '').trim() : null;
        })();
        return {
          findingId: f.id,
          title: f.title,
          severity: f.severity,
          line: f.cveId ? null : (f.description?.match(/Line\s+(\d+)/i)?.[1] ? parseInt(f.description.match(/Line\s+(\d+)/i)[1]) : null),
          beforeCode: before,
          afterCode: after,
        };
      }).filter((f: any) => f.afterCode);

      // Generate fixed code by applying patches bottom-to-top (preserve line numbers)
      let fixedCode = originalCode || null;
      if (originalCode && fixes.length > 0) {
        const lines = originalCode.split('\n');
        // Apply fixes sorted by line desc so earlier changes don't shift subsequent line numbers
        const sortedFixes = [...fixes].filter((f: any) => f.line).sort((a: any, b: any) => (b.line || 0) - (a.line || 0));
        for (const fix of sortedFixes as any[]) {
          if (fix.line && fix.line >= 1 && fix.line <= lines.length) {
            const afterLines = fix.afterCode.split('\n');
            lines.splice(fix.line - 1, 1, ...afterLines);
          }
        }
        fixedCode = lines.join('\n');
      }

      res.json({ originalCode, fixedCode, fixes });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Paid "Fix All" service - Creates payment intent for batch fix
  app.post("/api/linter-scans/:id/auto-fix-all", requireAuth, async (req: any, res) => {
    try {
      const scan = await storage.getLinterScan(req.params.id, req.user.id);
      
      if (!scan) {
        return res.status(404).json({ message: "Linter scan not found" });
      }

      // Get all findings for pricing calculation
      const findings = await storage.getFindingsByScan(req.params.id, req.user.id, 'linter');
      const issueCount = findings.length;

      // Calculate pricing: $5 base + $2 per issue
      const basePrice = 500; // $5 in cents
      const perIssuePrice = 200; // $2 in cents
      const totalAmount = basePrice + (issueCount * perIssuePrice);

      // Create fix batch with payment required
      const batch = await storage.createLinterFixBatch({
        userId: req.user.id,
        linterScanId: req.params.id,
        mode: 'all',
        findingId: null,
        findingsToFix: issueCount,
        status: 'pending',
        paymentAmount: totalAmount,
      });

      // Create Stripe payment intent
      let paymentIntentId: string | null = null;
      let clientSecret: string | null = null;
      let demoMode = false;

      if (!(process.env.TESTING_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY)) {
        console.warn('[Linter Auto-Fix] Stripe not configured, using demo mode');
        demoMode = true;
        clientSecret = 'demo_client_secret';
      } else {
        try {
    
          const stripe = new Stripe((process.env.TESTING_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY), {
            apiVersion: "2023-10-16",
          });

          const paymentIntent = await stripe.paymentIntents.create({
            amount: totalAmount,
            currency: 'usd',
            metadata: {
              userId: req.user.id,
              linterScanId: req.params.id,
              fixBatchId: batch.id,
              issueCount: issueCount.toString(),
            },
          });

          paymentIntentId = paymentIntent.id;
          clientSecret = paymentIntent.client_secret;
        } catch (stripeError) {
          console.error('[Linter Auto-Fix] Stripe error:', stripeError);
          return res.status(500).json({ message: 'Payment service error' });
        }
      }

      // Update batch with payment intent
      await storage.updateLinterFixBatch(batch.id, req.user.id, {
        stripePaymentIntentId: paymentIntentId,
      });

      res.json({
        batchId: batch.id,
        clientSecret,
        amount: totalAmount,
        issueCount,
        demoMode,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Confirm payment and start automated fix-all job
  app.post("/api/linter-fix-batches/:id/confirm-payment", requireAuth, async (req: any, res) => {
    try {
      const batch = await storage.getLinterFixBatch(req.params.id, req.user.id);
      
      if (!batch) {
        return res.status(404).json({ message: "Fix batch not found" });
      }

      if (batch.status !== 'pending') {
        return res.status(400).json({ message: "Batch is not awaiting payment" });
      }

      // Check for explicit demo mode flag from request
      const { demoMode } = req.body;

      // Strict payment verification with controlled demo mode support
      if (!batch.stripePaymentIntentId) {
        // No payment intent - this should only happen in demo mode
        if (!demoMode && (process.env.TESTING_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY)) {
          // Reject if not explicitly demo mode AND Stripe is available (should use real payment)
          return res.status(400).json({ 
            message: "Payment required. This batch requires a valid payment intent.",
            hint: "Use the /auto-fix-all endpoint to create a payment intent first"
          });
        }
        // Explicit demo mode with no Stripe - allow but log warning
        console.warn('[Linter Confirm Payment] DEMO MODE: Proceeding without payment verification');
      } else if (!(process.env.TESTING_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY)) {
        // Has payment intent but Stripe unavailable - reject
        return res.status(503).json({ 
          message: "Payment service unavailable. Stripe is not configured.",
          hint: "Contact support to configure Stripe keys"
        });
      } else {
        // Production: strict payment verification with terminal success states only
        try {
    
          const stripe = new Stripe((process.env.TESTING_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY), {
            apiVersion: "2023-10-16",
          });
          
          const paymentIntent = await stripe.paymentIntents.retrieve(batch.stripePaymentIntentId);
          
          // Only allow 'succeeded' - the only truly terminal success state
          if (paymentIntent.status !== 'succeeded') {
            return res.status(400).json({ 
              message: "Payment not completed. Please complete payment before proceeding.",
              paymentStatus: paymentIntent.status 
            });
          }

          // Verify amount matches expected
          if (batch.paymentAmount && paymentIntent.amount !== batch.paymentAmount) {
            return res.status(400).json({ 
              message: "Payment amount mismatch",
              expected: batch.paymentAmount,
              received: paymentIntent.amount
            });
          }
        } catch (stripeError) {
          console.error('[Linter Confirm Payment] Stripe verification failed:', stripeError);
          return res.status(500).json({ message: "Payment verification failed" });
        }
      }

      // Update batch status to start processing
      await storage.updateLinterFixBatch(batch.id, req.user.id, {
        status: 'applying',
        paymentStatus: 'paid',
        progress: 10,
      });

      // Start automated fix process (simulate with timeout)
      setTimeout(async () => {
        try {
          await storage.updateLinterFixBatch(batch.id, req.user.id, {
            status: 'validating',
            progress: 50,
            findingsFixed: batch.findingsToFix,
          });

          // Simulate validation (2 seconds)
          setTimeout(async () => {
            try {
              await storage.updateLinterFixBatch(batch.id, req.user.id, {
                status: 'completed',
                progress: 100,
                validationStatus: 'pass',
                uploadStatus: 'pending',
              });

              // Update scan with fix applied status
              await storage.updateLinterScan(batch.linterScanId!, req.user.id, {
                fixesApplied: true,
                lastValidationStatus: 'pass',
              });
            } catch (error) {
              console.error('[Linter Auto-Fix] Validation failed:', error);
              await storage.updateLinterFixBatch(batch.id, req.user.id, {
                status: 'failed',
                errorMessage: 'Validation failed',
              });
            }
          }, 2000);
        } catch (error) {
          console.error('[Linter Auto-Fix] Fix application failed:', error);
          await storage.updateLinterFixBatch(batch.id, req.user.id, {
            status: 'failed',
            errorMessage: 'Fix application failed',
          });
        }
      }, 3000);

      res.json({ message: "Payment confirmed, fix job started", batchId: batch.id });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/linter-scans/:id/upload", requireAuth, async (req: any, res) => {
    try {
      const { withFixes } = req.body;
      const scan = await storage.getLinterScan(req.params.id, req.user.id);
      
      if (!scan) {
        return res.status(404).json({ message: "Scan not found" });
      }

      // If uploading with fixes, mark all findings for this scan as resolved and update scan status
      if (withFixes) {
        await applyFixesForScan(req.params.id, 'linter', req.user.id);
        await storage.updateLinterScan(req.params.id, req.user.id, { 
          fixesApplied: true,
          lastValidationStatus: 'pass',
          lastUploadStatus: 'pending',
        });

        // Find and update the most recent completed batch for this scan
        const batches = await storage.getLinterFixBatchByScan(req.params.id, req.user.id);
        const completedBatch = batches.find(b => b.status === 'completed');
        if (completedBatch) {
          await storage.updateLinterFixBatch(completedBatch.id, req.user.id, {
            uploadStatus: 'uploading',
          });
        }
      } else {
        await storage.updateLinterScan(req.params.id, req.user.id, { 
          lastUploadStatus: 'pending',
        });
      }

      // Simulate upload to repository (4 seconds)
      setTimeout(async () => {
        try {
          await storage.updateLinterScan(req.params.id, req.user.id, {
            lastUploadStatus: 'success',
          });

          // Update batch upload status if uploading with fixes
          if (withFixes) {
            const batches = await storage.getLinterFixBatchByScan(req.params.id, req.user.id);
            const completedBatch = batches.find(b => b.status === 'completed');
            if (completedBatch) {
              await storage.updateLinterFixBatch(completedBatch.id, req.user.id, {
                uploadStatus: 'success',
              });
            }
          }

          // Send push notification for upload completion
          await notifyUploadComplete(
            storage,
            req.user.id,
            req.params.id,
            'linter',
            scan.repositoryUrl || 'repository'
          );
        } catch (error) {
          console.error('[Linter Upload] Upload failed:', error);
          await storage.updateLinterScan(req.params.id, req.user.id, {
            lastUploadStatus: 'failed',
          });
        }
      }, 4000);

      res.json({ message: "Upload initiated" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/linter-scans/:id/upload-with-tests", requireAuth, async (req: any, res) => {
    try {
      const { withFixes } = req.body;
      const scan = await storage.getLinterScan(req.params.id, req.user.id);
      
      if (!scan) {
        return res.status(404).json({ message: "Scan not found" });
      }

      // If uploading with fixes, mark all findings for this scan as resolved and update scan status
      if (withFixes) {
        await applyFixesForScan(req.params.id, 'linter', req.user.id);
        await storage.updateLinterScan(req.params.id, req.user.id, { 
          fixesApplied: true,
          lastValidationStatus: 'pending',
          lastUploadStatus: 'pending',
        });

        // Find and update the most recent completed batch for this scan
        const batches = await storage.getLinterFixBatchByScan(req.params.id, req.user.id);
        const completedBatch = batches.find(b => b.status === 'completed');
        if (completedBatch) {
          await storage.updateLinterFixBatch(completedBatch.id, req.user.id, {
            uploadStatus: 'uploading',
          });
        }
      } else {
        await storage.updateLinterScan(req.params.id, req.user.id, { 
          lastValidationStatus: 'pending',
          lastUploadStatus: 'pending',
        });
      }

      // Simulate upload with comprehensive testing (6 seconds)
      setTimeout(async () => {
        try {
          await storage.updateLinterScan(req.params.id, req.user.id, {
            lastValidationStatus: 'pass',
            lastUploadStatus: 'success',
          });

          // Update batch upload status if uploading with fixes
          if (withFixes) {
            const batches = await storage.getLinterFixBatchByScan(req.params.id, req.user.id);
            const completedBatch = batches.find(b => b.status === 'completed');
            if (completedBatch) {
              await storage.updateLinterFixBatch(completedBatch.id, req.user.id, {
                uploadStatus: 'success',
              });
            }
          }

          // Send push notification for upload + test completion
          await notifyUploadComplete(
            storage,
            req.user.id,
            req.params.id,
            'linter',
            scan.repositoryUrl || 'repository'
          );
        } catch (error) {
          console.error('[Linter Upload with Tests] Upload failed:', error);
          await storage.updateLinterScan(req.params.id, req.user.id, {
            lastValidationStatus: 'failed',
            lastUploadStatus: 'failed',
          });
        }
      }, 6000);

      res.json({ message: "Upload with tests initiated" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/linter-fix-batches/:id", requireAuth, async (req: any, res) => {
    try {
      const batch = await storage.getLinterFixBatch(req.params.id, req.user.id);
      if (!batch) {
        return res.status(404).json({ message: "Fix batch not found" });
      }
      res.json(batch);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/linter-scans/:id/fix-batches", requireAuth, async (req: any, res) => {
    try {
      const batches = await storage.getLinterFixBatchByScan(req.params.id, req.user.id);
      res.json(batches);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Pipeline Fix Batch endpoints
  app.post("/api/pipeline-scans/:id/fix", requireAuth, async (req: any, res) => {
    try {
      const { mode, findingId } = req.body;
      const scan = await storage.getPipelineScan(req.params.id, req.user.id);
      
      if (!scan) {
        return res.status(404).json({ message: "Pipeline scan not found" });
      }

      // Enforce single fix only for free path - redirect to paid endpoint for batch fixes
      if (mode === 'all') {
        return res.status(400).json({ 
          message: "Batch 'fix all' requires payment. Use /auto-fix-all endpoint instead.",
          redirectTo: `/api/pipeline-scans/${req.params.id}/auto-fix-all`
        });
      }

      if (!findingId) {
        return res.status(400).json({ message: "findingId is required for single fix" });
      }

      // Create fix batch job (free path - single fix only)
      const batch = await storage.createPipelineFixBatch({
        userId: req.user.id,
        pipelineScanId: req.params.id,
        mode: 'single',
        findingId,
        findingsToFix: 1,
        status: 'applying',
      });

      // Simulate fix application (3 seconds)
      setTimeout(async () => {
        try {
          await storage.updatePipelineFixBatch(batch.id, req.user.id, {
            status: 'validating',
            progress: 50,
            findingsFixed: 1,
          });

          // Simulate validation (2 seconds)
          setTimeout(async () => {
            try {
              await storage.updatePipelineFixBatch(batch.id, req.user.id, {
                status: 'completed',
                progress: 100,
                validationStatus: 'pass',
                uploadStatus: 'pending',
              });

              // Mark finding as fixed
              await storage.updateFinding(findingId, req.user.id, {
                fixesApplied: true,
                status: 'resolved',
              });

              // Update scan fix status
              await storage.updatePipelineScan(req.params.id, req.user.id, {
                fixesApplied: true,
                lastValidationStatus: 'pass',
              });

              // Send push notification
              await notifyFixesApplied(
                storage,
                req.user.id,
                req.params.id,
                'ci-cd',
                1
              );
            } catch (error) {
              console.error('[Pipeline Fix] Validation failed:', error);
              await storage.updatePipelineFixBatch(batch.id, req.user.id, {
                status: 'failed',
                errorMessage: 'Validation failed',
              });
            }
          }, 2000);
        } catch (error) {
          console.error('[Pipeline Fix] Application failed:', error);
          await storage.updatePipelineFixBatch(batch.id, req.user.id, {
            status: 'failed',
            errorMessage: 'Fix application failed',
          });
        }
      }, 3000);

      res.json(batch);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/pipeline-scans/:id/auto-fix-all", requireAuth, async (req: any, res) => {
    try {
      const scan = await storage.getPipelineScan(req.params.id, req.user.id);
      
      if (!scan) {
        return res.status(404).json({ message: "Pipeline scan not found" });
      }

      // Get all findings for pricing calculation
      const findings = await storage.getFindingsByScan(req.params.id, req.user.id, 'pipeline');
      const issueCount = findings.length;

      // Calculate pricing: $5 base + $2 per issue
      const basePrice = 500; // $5 in cents
      const perIssuePrice = 200; // $2 in cents
      const totalAmount = basePrice + (issueCount * perIssuePrice);

      // Create fix batch with payment required
      const batch = await storage.createPipelineFixBatch({
        userId: req.user.id,
        pipelineScanId: req.params.id,
        mode: 'all',
        findingId: null,
        findingsToFix: issueCount,
        status: 'pending',
        paymentAmount: totalAmount,
      });

      // Create Stripe payment intent
      let paymentIntentId: string | null = null;
      let clientSecret: string | null = null;
      let demoMode = false;

      if (!(process.env.TESTING_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY)) {
        console.warn('[Pipeline Auto-Fix] Stripe not configured, using demo mode');
        demoMode = true;
        clientSecret = 'demo_client_secret';
      } else {
        try {
    
          const stripe = new Stripe((process.env.TESTING_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY), {
            apiVersion: "2023-10-16",
          });

          const paymentIntent = await stripe.paymentIntents.create({
            amount: totalAmount,
            currency: 'usd',
            metadata: {
              userId: req.user.id,
              pipelineScanId: req.params.id,
              fixBatchId: batch.id,
              issueCount: issueCount.toString(),
            },
          });

          paymentIntentId = paymentIntent.id;
          clientSecret = paymentIntent.client_secret;
        } catch (stripeError) {
          console.error('[Pipeline Auto-Fix] Stripe error:', stripeError);
          return res.status(500).json({ message: 'Payment service error' });
        }
      }

      // Update batch with payment intent
      await storage.updatePipelineFixBatch(batch.id, req.user.id, {
        stripePaymentIntentId: paymentIntentId,
      });

      res.json({
        batchId: batch.id,
        clientSecret,
        amount: totalAmount,
        issueCount,
        demoMode,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/pipeline-fix-batches/:id/confirm-payment", requireAuth, async (req: any, res) => {
    try {
      const batch = await storage.getPipelineFixBatch(req.params.id, req.user.id);
      
      if (!batch) {
        return res.status(404).json({ message: "Fix batch not found" });
      }

      if (batch.status !== 'pending') {
        return res.status(400).json({ message: "Batch is not awaiting payment" });
      }

      // Check for explicit demo mode flag from request
      const { demoMode } = req.body;

      // Strict payment verification with controlled demo mode support
      if (!batch.stripePaymentIntentId) {
        // No payment intent - this should only happen in demo mode
        if (!demoMode && (process.env.TESTING_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY)) {
          // Reject if not explicitly demo mode AND Stripe is available (should use real payment)
          return res.status(400).json({ 
            message: "Payment required. This batch requires a valid payment intent.",
            hint: "Use the /auto-fix-all endpoint to create a payment intent first"
          });
        }
        // Explicit demo mode with no Stripe - allow but log warning
        console.warn('[Pipeline Confirm Payment] DEMO MODE: Proceeding without payment verification');
      } else if (!(process.env.TESTING_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY)) {
        // Has payment intent but Stripe unavailable - reject
        return res.status(503).json({ 
          message: "Payment service unavailable. Stripe is not configured.",
          hint: "Contact support to configure Stripe keys"
        });
      } else {
        // Production: strict payment verification with terminal success states only
        try {
    
          const stripe = new Stripe((process.env.TESTING_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY), {
            apiVersion: "2023-10-16",
          });
          
          const paymentIntent = await stripe.paymentIntents.retrieve(batch.stripePaymentIntentId);
          
          // Only allow 'succeeded' - the only truly terminal success state
          if (paymentIntent.status !== 'succeeded') {
            return res.status(400).json({ 
              message: "Payment not completed. Please complete payment before proceeding.",
              paymentStatus: paymentIntent.status 
            });
          }

          // Verify amount matches expected
          if (batch.paymentAmount && paymentIntent.amount !== batch.paymentAmount) {
            return res.status(400).json({ 
              message: "Payment amount mismatch",
              expected: batch.paymentAmount,
              received: paymentIntent.amount
            });
          }
        } catch (stripeError) {
          console.error('[Pipeline Confirm Payment] Stripe verification failed:', stripeError);
          return res.status(500).json({ message: "Payment verification failed" });
        }
      }

      // Update batch status to start processing
      await storage.updatePipelineFixBatch(batch.id, req.user.id, {
        status: 'applying',
        paymentStatus: 'paid',
        startedAt: new Date(),
        progress: 10,
      });

      // Simulate batch fix application (6 seconds total)
      setTimeout(async () => {
        try {
          await storage.updatePipelineFixBatch(batch.id, req.user.id, {
            status: 'validating',
            progress: 60,
            findingsFixed: batch.findingsToFix,
          });

          // Simulate validation (3 seconds)
          setTimeout(async () => {
            try {
              await storage.updatePipelineFixBatch(batch.id, req.user.id, {
                status: 'completed',
                progress: 100,
                validationStatus: 'pass',
                uploadStatus: 'pending',
                completedAt: new Date(),
              });

              // Mark all findings as fixed
              const findings = await storage.getFindingsByScan(batch.pipelineScanId, req.user.id, 'pipeline');
              for (const finding of findings) {
                await storage.updateFinding(finding.id, req.user.id, {
                  fixesApplied: true,
                  status: 'resolved',
                });
              }

              // Update scan fix status
              await storage.updatePipelineScan(batch.pipelineScanId, req.user.id, {
                fixesApplied: true,
                lastValidationStatus: 'pass',
              });

              // Send push notification
              await notifyFixesApplied(
                storage,
                req.user.id,
                batch.pipelineScanId,
                'ci-cd',
                batch.findingsToFix
              );
            } catch (error) {
              console.error('[Pipeline Auto-Fix] Validation failed:', error);
              await storage.updatePipelineFixBatch(batch.id, req.user.id, {
                status: 'failed',
                errorMessage: 'Validation failed',
              });
            }
          }, 3000);
        } catch (error) {
          console.error('[Pipeline Auto-Fix] Application failed:', error);
          await storage.updatePipelineFixBatch(batch.id, req.user.id, {
            status: 'failed',
            errorMessage: 'Fix application failed',
          });
        }
      }, 3000);

      res.json({ message: "Payment confirmed, fix process started", batch });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/pipeline-fix-batches/:id", requireAuth, async (req: any, res) => {
    try {
      const batch = await storage.getPipelineFixBatch(req.params.id, req.user.id);
      if (!batch) {
        return res.status(404).json({ message: "Fix batch not found" });
      }
      res.json(batch);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/pipeline-scans/:id/fix-batches", requireAuth, async (req: any, res) => {
    try {
      const batches = await storage.getPipelineFixBatchByScan(req.params.id, req.user.id);
      res.json(batches);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Scheduled Scans endpoints
  app.get("/api/scheduled-scans", requireAuth, async (req: any, res) => {
    try {
      const scans = await storage.getAllScheduledScans(req.user.id);
      res.json(scans);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/scheduled-scans", requireAuth, async (req: any, res) => {
    try {
      const validatedData = insertScheduledScanSchema.omit({ userId: true }).parse(req.body);
      const scan = await storage.createScheduledScan({
        ...validatedData,
        userId: req.user.id,
      });
      res.status(201).json(scan);
    } catch (error: any) {
      if (error instanceof ZodError) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  app.patch("/api/scheduled-scans/:id", requireAuth, async (req: any, res) => {
    try {
      const validatedData = insertScheduledScanSchema.partial().parse(req.body);
      const scan = await storage.updateScheduledScan(req.params.id, req.user.id, validatedData);
      if (!scan) {
        return res.status(404).json({ message: "Scheduled scan not found" });
      }
      res.json(scan);
    } catch (error: any) {
      if (error instanceof ZodError) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  app.delete("/api/scheduled-scans/:id", requireAuth, async (req: any, res) => {
    try {
      await storage.deleteScheduledScan(req.params.id, req.user.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Alert Settings endpoints
  app.get("/api/alert-settings", requireAuth, async (req: any, res) => {
    try {
      const settings = await storage.getAlertSettings(req.user.id);
      res.json(settings || {});
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/alert-settings", requireAuth, async (req: any, res) => {
    try {
      const validatedData = insertAlertSettingsSchema.partial().parse(req.body);
      const settings = await storage.updateAlertSettings(req.user.id, validatedData);
      res.json(settings);
    } catch (error: any) {
      if (error instanceof ZodError) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  // Threat Intelligence Feed endpoint
  app.get("/api/threat-feed", async (_req, res) => {
    try {
      const threats = await fetchThreatIntelligence();
      res.json(threats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Test alert endpoint (for webhook testing)
  app.post("/api/test-alert", requireAuth, async (req: any, res) => {
    try {
      const { findingId } = req.body;
      if (!findingId) {
        return res.status(400).json({ message: "Finding ID is required" });
      }

      const finding = await storage.getFinding(findingId, req.user.id);
      if (!finding) {
        return res.status(404).json({ message: "Finding not found" });
      }

      const alertSettings = await storage.getAlertSettings(req.user.id);
      if (!alertSettings) {
        return res.status(400).json({ message: "Alert settings not configured" });
      }

      await sendAlerts(finding, alertSettings);
      res.json({ success: true, message: "Test alert sent successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Terms of Service Acceptance endpoints
  app.get("/api/terms-of-service/status", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      const tosAcceptance = await storage.getToSAcceptance(userId);
      
      if (!tosAcceptance) {
        // No record means user hasn't accepted yet
        return res.json({ accepted: false, version: null });
      }
      
      res.json({
        accepted: tosAcceptance.accepted,
        version: tosAcceptance.version,
        acceptedAt: tosAcceptance.acceptedAt
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/terms-of-service/accept", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      const ipAddress = req.ip || req.connection.remoteAddress || "unknown";
      const userAgent = req.headers["user-agent"] || "unknown";
      
      // Check if user already has a ToS record
      const existing = await storage.getToSAcceptance(userId);
      
      if (existing) {
        // Update existing record
        const updated = await storage.updateToSAcceptance(userId, {
          accepted: true,
          acceptedAt: new Date(),
          ipAddress,
          userAgent,
        });
        return res.json(updated);
      } else {
        // Create new record
        const acceptance = await storage.createToSAcceptance({
          userId,
          version: "1.0",
          accepted: true,
          acceptedAt: new Date(),
          ipAddress,
          userAgent,
        });
        res.status(201).json(acceptance);
      }
    } catch (error: any) {
      if (error instanceof ZodError) {
        res.status(400).json({ message: error.message, errors: error.errors });
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  // SSO Provider Management endpoints
  app.get("/api/sso/providers", async (_req, res) => {
    try {
      const providers = await storage.getAllSsoProviders();
      res.json(providers);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/sso/providers/enabled", async (_req, res) => {
    try {
      const providers = await storage.getEnabledSsoProviders();
      // Return only public info for login page
      const publicProviders = providers.map(p => ({
        id: p.id,
        name: p.name,
        type: p.type,
      }));
      res.json(publicProviders);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/sso/providers", async (req, res) => {
    try {
      console.log('[SSO Debug] POST /api/sso/providers body:', JSON.stringify(req.body, null, 2));
      const validatedData = insertSsoProviderSchema.parse(req.body);
      const provider = await storage.createSsoProvider(validatedData);
      
      // Clear OIDC client cache if it's an OIDC provider
      if (provider.type === 'oidc') {
        clearOidcClientCache(provider.id);
      }
      
      console.log('[SSO Debug] Provider created successfully:', provider.id);
      res.status(201).json(provider);
    } catch (error: any) {
      console.error('[SSO Debug] Error creating provider:', error);
      if (error instanceof ZodError) {
        console.error('[SSO Debug] Validation errors:', error.errors);
        res.status(400).json({ message: error.message, errors: error.errors });
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  app.patch("/api/sso/providers/:id", async (req, res) => {
    try {
      const validatedData = insertSsoProviderSchema.partial().parse(req.body);
      const provider = await storage.updateSsoProvider(req.params.id, validatedData);
      
      if (!provider) {
        return res.status(404).json({ message: "SSO provider not found" });
      }
      
      // Clear OIDC client cache when provider is updated
      if (provider.type === 'oidc') {
        clearOidcClientCache(provider.id);
      }
      
      res.json(provider);
    } catch (error: any) {
      if (error instanceof ZodError) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  app.delete("/api/sso/providers/:id", async (req, res) => {
    try {
      const provider = await storage.getSsoProvider(req.params.id);
      if (!provider) {
        return res.status(404).json({ message: "SSO provider not found" });
      }
      
      await storage.deleteSsoProvider(req.params.id);
      
      // Clear OIDC client cache
      if (provider.type === 'oidc') {
        clearOidcClientCache(provider.id);
      }
      
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // SAML SSO endpoints
  app.get("/api/sso/saml/login/:providerId", async (req, res) => {
    try {
      const provider = await storage.getSsoProvider(req.params.providerId);
      
      if (!provider || !provider.enabled) {
        return res.status(404).json({ message: "SSO provider not found or disabled" });
      }
      
      if (provider.type !== 'saml') {
        return res.status(400).json({ message: "Provider is not a SAML provider" });
      }

      const strategy = createSamlStrategy(provider);
      
      passport.use(`saml-${provider.id}`, strategy);
      
      passport.authenticate(`saml-${provider.id}`, {
        failureRedirect: '/login?error=sso_failed',
        session: false,
      })(req, res);
    } catch (error: any) {
      console.error('SAML login error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/sso/saml/callback/:providerId", async (req, res) => {
    try {
      const provider = await storage.getSsoProvider(req.params.providerId);
      
      if (!provider || !provider.enabled) {
        console.log(`[SSO Audit] SAML login failed - provider not found or disabled: ${req.params.providerId}`);
        return res.status(404).json({ message: "SSO provider not found or disabled" });
      }

      const strategy = createSamlStrategy(provider);
      passport.use(`saml-${provider.id}`, strategy);

      passport.authenticate(`saml-${provider.id}`, {
        failureRedirect: '/login?error=sso_failed',
        session: false,
      }, (err: any, user: any) => {
        if (err || !user) {
          console.log(`[SSO Audit] SAML login failed for provider ${provider.name}: ${err?.message || 'Unknown error'}`);
          return res.redirect('/login?error=sso_failed');
        }

        console.log(`[SSO Audit] SAML login successful - Provider: ${provider.name}, User: ${user.email}, Time: ${new Date().toISOString()}`);
        
        res.redirect(`/?sso_success=true&email=${encodeURIComponent(user.email)}`);
      })(req, res);
    } catch (error: any) {
      console.error(`[SSO Audit] SAML callback error for provider ${req.params.providerId}:`, error);
      res.redirect('/login?error=sso_failed');
    }
  });

  app.get("/api/sso/saml/metadata/:providerId", async (req, res) => {
    try {
      const provider = await storage.getSsoProvider(req.params.providerId);
      
      if (!provider || provider.type !== 'saml') {
        return res.status(404).json({ message: "SAML provider not found" });
      }

      const metadata = generateSamlMetadata(provider);
      res.type('application/xml');
      res.send(metadata);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Test OIDC Provider endpoints (for development testing)
  // Handle REPLIT_DEV_DOMAIN which may or may not include https:// prefix
  const testOidcBaseUrl = process.env.REPLIT_DEV_DOMAIN 
    ? (process.env.REPLIT_DEV_DOMAIN.startsWith('http') 
        ? process.env.REPLIT_DEV_DOMAIN 
        : `https://${process.env.REPLIT_DEV_DOMAIN}`)
    : 'http://localhost:5000';
  console.log('[OIDC] Test OIDC base URL:', testOidcBaseUrl);

  // OIDC Discovery endpoint
  app.get("/test-oidc/.well-known/openid-configuration", (_req, res) => {
    res.json({
      issuer: `${testOidcBaseUrl}/test-oidc`,
      authorization_endpoint: `${testOidcBaseUrl}/test-oidc/authorize`,
      token_endpoint: `${testOidcBaseUrl}/test-oidc/token`,
      userinfo_endpoint: `${testOidcBaseUrl}/test-oidc/userinfo`,
      jwks_uri: `${testOidcBaseUrl}/test-oidc/jwks`,
      response_types_supported: ["code"],
      subject_types_supported: ["public"],
      id_token_signing_alg_values_supported: ["RS256"],
      scopes_supported: ["openid", "profile", "email"],
      token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic"],
      claims_supported: ["sub", "email", "name", "given_name", "family_name"],
      code_challenge_methods_supported: ["S256"],
    });
  });

  // JWKS endpoint (mock keys for testing)
  app.get("/test-oidc/jwks", (_req, res) => {
    res.json({ keys: [] });
  });

  // Test authorization endpoint - simulates login and redirects back
  app.get("/test-oidc/authorize", (req, res) => {
    const { redirect_uri, state, code_challenge, nonce } = req.query;
    
    if (!redirect_uri) {
      return res.status(400).json({ error: "missing_redirect_uri" });
    }

    // Generate a mock authorization code
    const mockCode = randomBytes(16).toString('hex');
    
    // Store the code challenge and nonce for later verification
    (req.app as any).testOidcCodes = (req.app as any).testOidcCodes || {};
    (req.app as any).testOidcCodes[mockCode] = {
      code_challenge,
      nonce: nonce as string,
      createdAt: Date.now(),
    };

    // Redirect back with the code
    const redirectUrl = new URL(redirect_uri as string);
    redirectUrl.searchParams.set('code', mockCode);
    if (state) {
      redirectUrl.searchParams.set('state', state as string);
    }
    
    res.redirect(redirectUrl.toString());
  });

  // Test token endpoint - use json parsing since urlencoded is already set up globally
  app.post("/test-oidc/token", (req, res) => {
    const { code, redirect_uri } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: "invalid_grant", error_description: "Missing code" });
    }

    // Retrieve stored code data including nonce
    const codeData = (req.app as any).testOidcCodes?.[code];
    const nonce = codeData?.nonce;

    // Clean up used code
    if ((req.app as any).testOidcCodes) {
      delete (req.app as any).testOidcCodes[code];
    }

    // Create mock tokens with nonce included
    const mockAccessToken = randomBytes(32).toString('hex');
    const idTokenPayload: any = {
      iss: `${testOidcBaseUrl}/test-oidc`,
      sub: "test-user-123",
      aud: "test-client-id",
      email: "testuser@example.com",
      name: "Test User",
      given_name: "Test",
      family_name: "User",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    // Include nonce if it was provided in the authorization request
    if (nonce) {
      idTokenPayload.nonce = nonce;
    }

    const mockIdToken = `eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.${Buffer.from(JSON.stringify(idTokenPayload)).toString('base64url')}.mock-signature`;

    res.json({
      access_token: mockAccessToken,
      id_token: mockIdToken,
      token_type: "Bearer",
      expires_in: 3600,
    });
  });

  // Test userinfo endpoint
  app.get("/test-oidc/userinfo", (_req, res) => {
    res.json({
      sub: "test-user-123",
      email: "testuser@example.com",
      name: "Test User",
      given_name: "Test",
      family_name: "User",
    });
  });

  // OIDC/OAuth SSO endpoints
  app.get("/api/sso/oidc/login/:providerId", async (req, res) => {
    try {
      const provider = await storage.getSsoProvider(req.params.providerId);
      
      if (!provider || !provider.enabled) {
        return res.status(404).json({ message: "SSO provider not found or disabled" });
      }
      
      if (provider.type !== 'oidc') {
        return res.status(400).json({ message: "Provider is not an OIDC provider" });
      }

      // Generate random state for CSRF protection
      const state = randomBytes(16).toString('hex');
      
      // Store state in session (you may want to use a proper session store)
      // For now, we'll pass it through the flow
      
      const authUrl = await getAuthorizationUrl(provider, state);
      res.redirect(authUrl);
    } catch (error: any) {
      console.error('OIDC login error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/sso/oidc/callback/:providerId", async (req: any, res) => {
    try {
      const provider = await storage.getSsoProvider(req.params.providerId);
      
      if (!provider || !provider.enabled) {
        console.log(`[SSO Audit] OIDC login failed - provider not found or disabled: ${req.params.providerId}`);
        return res.status(404).json({ message: "SSO provider not found or disabled" });
      }

      const { code, state } = req.query;
      
      if (!code || !state) {
        console.log(`[SSO Audit] OIDC login failed for provider ${provider.name}: Missing code or state`);
        return res.redirect('/login?error=missing_params');
      }

      // Special handling for test OIDC provider - bypass JWT validation
      if (provider.id === 'test-oidc-provider') {
        console.log(`[SSO Audit] Test OIDC provider - creating test user session`);
        
        // Create or find the test user
        let testUser = await storage.getUserByEmail('testuser@example.com');
        if (!testUser) {
          // Create the test user with all required fields
          testUser = await storage.createUser({
            email: 'testuser@example.com',
            username: 'testuser_oidc',
            password: 'test-oidc-user-password-' + randomBytes(16).toString('hex'),
            firstName: 'Test',
            lastName: 'User',
          });
        }

        // Create session using the app's custom session system
        const sessionId = await createSession(storage, testUser.id);
        
        // Set session cookie
        res.cookie('sessionId', sessionId, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });
        
        console.log(`[SSO Audit] Test OIDC login successful - User: ${testUser.email}, Time: ${new Date().toISOString()}`);
        res.redirect(`/?sso_success=true&email=${encodeURIComponent(testUser.email)}`);
        return;
      }

      const user = await handleOidcCallback(provider, req.query, state as string);
      
      console.log(`[SSO Audit] OIDC login successful - Provider: ${provider.name}, User: ${user.email}, Time: ${new Date().toISOString()}`);
      
      res.redirect(`/?sso_success=true&email=${encodeURIComponent(user.email)}`);
    } catch (error: any) {
      console.error(`[SSO Audit] OIDC callback error for provider ${req.params.providerId}:`, error);
      res.redirect('/login?error=sso_failed');
    }
  });

  // Notification routes
  app.get("/api/notifications", requireAuth, async (req: any, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit) : 50;
      const notifications = await storage.getNotifications(req.user.id, limit);
      res.json(notifications);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/notifications/unread", requireAuth, async (req: any, res) => {
    try {
      const notifications = await storage.getUnreadNotifications(req.user.id);
      res.json(notifications);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/notifications/unread/count", requireAuth, async (req: any, res) => {
    try {
      const count = await storage.getUnreadNotificationCount(req.user.id);
      res.json({ count });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/notifications/:id/read", requireAuth, async (req: any, res) => {
    try {
      const notification = await storage.markNotificationAsRead(req.params.id, req.user.id);
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      res.json(notification);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/notifications/mark-all-read", requireAuth, async (req: any, res) => {
    try {
      await storage.markAllNotificationsAsRead(req.user.id);
      res.json({ success: true, message: "All notifications marked as read" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Setup periodic session cleanup
  setupSessionCleanup(storage);

  const httpServer = createServer(app);

  return httpServer;
}
