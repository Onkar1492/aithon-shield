import webpush from 'web-push';
import type { IStorage } from './storage';

// Get VAPID keys from environment variables or generate new ones for development
function getVapidKeys(): { publicKey: string; privateKey: string; subject: string } {
  // Try to get keys from environment
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:aegis@auditor.com';

  // If keys are not in environment, generate new ones for development
  if (!publicKey || !privateKey) {
    console.warn('[Push Notification] VAPID keys not found in environment, generating new keys for development...');
    console.warn('[Push Notification] In production, set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY environment variables');
    
    const vapidKeys = webpush.generateVAPIDKeys();
    console.log('[Push Notification] Generated VAPID keys:');
    console.log(`[Push Notification]   VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
    console.log(`[Push Notification]   VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
    console.log('[Push Notification] Save these keys as environment variables for consistent operation');
    
    return {
      publicKey: vapidKeys.publicKey,
      privateKey: vapidKeys.privateKey,
      subject,
    };
  }

  return { publicKey, privateKey, subject };
}

// Initialize VAPID keys
const vapidKeys = getVapidKeys();

// Configure web-push with VAPID keys
webpush.setVapidDetails(
  vapidKeys.subject,
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

export function getVapidPublicKey(): string {
  return vapidKeys.publicKey;
}

interface NotificationData {
  url?: string;
  tag?: string;
  [key: string]: any;
}

type NotificationType = 'scan_start' | 'scan_complete' | 'fixes_applied' | 'upload_complete';

export async function sendPushNotification(
  storage: IStorage,
  userId: string,
  title: string,
  body: string,
  type: NotificationType,
  scanId?: string,
  scanType?: string,
  data?: NotificationData
): Promise<void> {
  try {
    // Get user from storage
    const user = await storage.getUser(userId);
    if (!user) {
      console.log(`[Push Notification] User not found: ${userId}`);
      return;
    }

    // Check if user has push notifications enabled
    if (!user.pushNotificationsEnabled) {
      console.log(`[Push Notification] Push notifications disabled for user: ${userId}`);
      return;
    }

    // Note: Specific preference checks (notifyOnScanComplete, notifyOnFixesApplied, etc.)
    // are handled by the helper functions before calling sendPushNotification

    // Create notification record in database
    try {
      await storage.createNotification({
        userId,
        type,
        title,
        message: body,
        scanId: scanId || null,
        scanType: scanType || null,
        read: false,
      });
    } catch (dbError) {
      console.error(`[Push Notification] Failed to create notification record:`, dbError);
    }

    // Check if user has a push subscription
    if (!user.pushSubscription) {
      console.log(`[Push Notification] No push subscription for user: ${userId}`);
      return;
    }

    // Parse the subscription object
    let subscription;
    try {
      subscription = JSON.parse(user.pushSubscription);
    } catch (error) {
      console.error(`[Push Notification] Invalid subscription format for user ${userId}:`, error);
      return;
    }

    // Prepare notification payload
    const payload = JSON.stringify({
      title,
      body,
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      data: data || {},
    });

    // Send the push notification
    await webpush.sendNotification(subscription, payload);
    console.log(`[Push Notification] Sent to user ${userId}: ${title}`);
  } catch (error: any) {
    // Handle errors gracefully - don't throw
    if (error.statusCode === 410) {
      // Subscription has expired or is no longer valid
      console.log(`[Push Notification] Subscription expired for user ${userId}, removing...`);
      try {
        await storage.updateUser(userId, { pushSubscription: null });
      } catch (updateError) {
        console.error(`[Push Notification] Failed to remove invalid subscription:`, updateError);
      }
    } else {
      console.error(`[Push Notification] Failed to send to user ${userId}:`, error);
    }
  }
}

// Helper functions for specific notification types
export async function notifyScanStart(
  storage: IStorage,
  userId: string,
  scanId: string,
  scanType: string,
  scanName: string
): Promise<void> {
  // Check user preference for scan start notifications
  const user = await storage.getUser(userId);
  if (!user?.notifyOnScanStart) {
    console.log(`[Push Notification] Scan start notifications disabled for user: ${userId}`);
    return;
  }

  await sendPushNotification(
    storage,
    userId,
    'Scan Started',
    `${scanName} scan has started`,
    'scan_start',
    scanId,
    scanType,
    { url: `/scans/${scanType}/${scanId}`, tag: `scan-${scanId}` }
  );
}

export async function notifyScanComplete(
  storage: IStorage,
  userId: string,
  scanId: string,
  scanType: string,
  scanName: string,
  findingsCount: number
): Promise<void> {
  // Check user preference for scan completion notifications
  const user = await storage.getUser(userId);
  if (!user?.notifyOnScanComplete) {
    console.log(`[Push Notification] Scan completion notifications disabled for user: ${userId}`);
    return;
  }

  await sendPushNotification(
    storage,
    userId,
    'Scan Complete',
    `${scanName} scan finished with ${findingsCount} finding${findingsCount === 1 ? '' : 's'}`,
    'scan_complete',
    scanId,
    scanType,
    { url: `/scans/${scanType}/${scanId}`, tag: `scan-${scanId}` }
  );
}

export async function notifyFixesApplied(
  storage: IStorage,
  userId: string,
  scanId: string,
  scanType: string,
  fixCount: number
): Promise<void> {
  // Check user preference for fix applied notifications
  const user = await storage.getUser(userId);
  if (!user?.notifyOnFixesApplied) {
    console.log(`[Push Notification] Fix applied notifications disabled for user: ${userId}`);
    return;
  }

  await sendPushNotification(
    storage,
    userId,
    'Fixes Applied',
    `${fixCount} security fix${fixCount === 1 ? '' : 'es'} applied successfully`,
    'fixes_applied',
    scanId,
    scanType,
    { url: `/scans/${scanType}/${scanId}`, tag: `fixes-${scanId}` }
  );
}

export async function notifyUploadComplete(
  storage: IStorage,
  userId: string,
  scanId: string,
  scanType: string,
  destination: string
): Promise<void> {
  // Check user preference for upload notifications
  const user = await storage.getUser(userId);
  if (!user?.notifyOnUpload) {
    console.log(`[Push Notification] Upload notifications disabled for user: ${userId}`);
    return;
  }

  await sendPushNotification(
    storage,
    userId,
    'Upload Complete',
    `Your app has been uploaded to ${destination}`,
    'upload_complete',
    scanId,
    scanType,
    { url: `/scans/${scanType}/${scanId}`, tag: `upload-${scanId}` }
  );
}
