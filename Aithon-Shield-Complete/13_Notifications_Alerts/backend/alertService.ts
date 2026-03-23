import type { Finding, AlertSettings } from "@shared/schema";

/**
 * Alert Notification Service
 * Sends multi-channel alerts for security findings based on severity thresholds
 */

interface AlertPayload {
  finding: Finding;
  alertSettings: AlertSettings;
}

/**
 * Send Slack webhook notification
 */
async function sendSlackAlert(finding: Finding, webhookUrl: string): Promise<void> {
  const severityColor: Record<string, string> = {
    Critical: "#DC2626",
    High: "#EA580C",
    Medium: "#F59E0B",
    Low: "#6B7280",
  };

  const payload = {
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `🚨 ${finding.severity} Security Finding Detected`,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Title:*\n${finding.title}`,
          },
          {
            type: "mrkdwn",
            text: `*Severity:*\n${finding.severity}`,
          },
          {
            type: "mrkdwn",
            text: `*Asset:*\n${finding.asset}`,
          },
          {
            type: "mrkdwn",
            text: `*CWE:*\n${finding.cwe}`,
          },
          {
            type: "mrkdwn",
            text: `*Risk Score:*\n${finding.riskScore}/100`,
          },
          {
            type: "mrkdwn",
            text: `*Priority:*\n${finding.priorityScore}/100`,
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Detected: ${finding.detected} | Status: ${finding.status}`,
          },
        ],
      },
    ],
    attachments: [
      {
        color: severityColor[finding.severity] || "#6B7280",
        text: `View in Aithon Shield: /findings`,
      },
    ],
  };

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Slack webhook failed: ${response.statusText}`);
  }
}

/**
 * Send Microsoft Teams webhook notification
 */
async function sendTeamsAlert(finding: Finding, webhookUrl: string): Promise<void> {
  const severityColor: Record<string, string> = {
    Critical: "attention",
    High: "warning",
    Medium: "warning",
    Low: "good",
  };

  const payload = {
    "@type": "MessageCard",
    "@context": "https://schema.org/extensions",
    summary: `${finding.severity} Security Finding: ${finding.title}`,
    themeColor: severityColor[finding.severity] || "good",
    title: `🚨 ${finding.severity} Security Finding Detected`,
    sections: [
      {
        activityTitle: finding.title,
        facts: [
          { name: "Severity", value: finding.severity },
          { name: "Asset", value: finding.asset },
          { name: "CWE", value: finding.cwe },
          { name: "Risk Score", value: `${finding.riskScore}/100` },
          { name: "Priority", value: `${finding.priorityScore}/100` },
          { name: "Status", value: finding.status },
          { name: "Detected", value: finding.detected },
        ],
      },
    ],
    potentialAction: [
      {
        "@type": "OpenUri",
        name: "View in Aithon Shield",
        targets: [{ os: "default", uri: "/findings" }],
      },
    ],
  };

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Teams webhook failed: ${response.statusText}`);
  }
}

/**
 * Check if alert should be sent based on severity threshold
 */
function shouldSendAlert(finding: Finding, settings: AlertSettings): boolean {
  const severity = finding.severity.toLowerCase();
  
  if (severity === "critical" && settings.alertOnCritical) return true;
  if (severity === "high" && settings.alertOnHigh) return true;
  if (severity === "medium" && settings.alertOnMedium) return true;
  if (severity === "low" && settings.alertOnLow) return true;
  
  return false;
}

/**
 * Main function to send alerts through all enabled channels
 */
export async function sendAlerts(finding: Finding, settings: AlertSettings): Promise<void> {
  if (!shouldSendAlert(finding, settings)) {
    return; // Skip if severity doesn't meet threshold
  }

  const promises: Promise<void>[] = [];

  // Send Slack alert if enabled
  if (settings.slackEnabled && settings.slackWebhookUrl) {
    promises.push(
      sendSlackAlert(finding, settings.slackWebhookUrl).catch((error) => {
        console.error("Slack alert failed:", error);
      })
    );
  }

  // Send Teams alert if enabled
  if (settings.teamsEnabled && settings.teamsWebhookUrl) {
    promises.push(
      sendTeamsAlert(finding, settings.teamsWebhookUrl).catch((error) => {
        console.error("Teams alert failed:", error);
      })
    );
  }

  // Note: Email and SMS alerts would be implemented here
  // when connectors are set up (SendGrid/Resend for email, Twilio for SMS)

  await Promise.allSettled(promises);
}
