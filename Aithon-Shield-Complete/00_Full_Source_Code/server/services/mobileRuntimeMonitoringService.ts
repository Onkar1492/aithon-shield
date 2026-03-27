export type MobileRuntimeInsert = (data: {
  userId: string;
  mobileScanId: string;
  platform: string;
  eventType: string;
  severity: string;
  message: string;
  payload?: Record<string, unknown> | null;
}) => Promise<void>;

/**
 * P6-I1 — Record simulated runtime monitoring events after a mobile scan (device-farm style trace).
 * In production, an on-device agent would POST these; here we synthesize a short timeline.
 */
export async function recordSimulatedMobileRuntimeEvents(
  insert: MobileRuntimeInsert,
  userId: string,
  scanId: string,
  platform: "ios" | "android",
  appName: string,
): Promise<void> {
  const base = [
    {
      eventType: "runtime.bootstrap",
      severity: "info",
      message: `Simulated ${platform.toUpperCase()} runtime bootstrap for “${appName}” (P6-I1).`,
      payload: { platform, phase: "cold_start_ms", value: platform === "ios" ? 420 : 380 },
    },
    {
      eventType: "network.tls",
      severity: "info",
      message: "TLS session established to configured API host (simulated trace).",
      payload: { tlsVersion: "TLS 1.3", certificatePinning: "unknown" },
    },
    {
      eventType: "storage.keychain",
      severity: "low",
      message: "Sensitive preference read from secure storage (heuristic — not a finding).",
      payload: { area: "auth_token_cache" },
    },
    {
      eventType: "permissions.location",
      severity: "medium",
      message: "Location permission was active during simulated session (review privacy copy).",
      payload: { whenInUse: true },
    },
  ];

  for (const e of base) {
    await insert({
      userId,
      mobileScanId: scanId,
      platform,
      eventType: e.eventType,
      severity: e.severity,
      message: e.message,
      payload: e.payload,
    });
  }
}
