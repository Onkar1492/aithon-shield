import { storage } from "./storage";

export function getRequestMeta(req: any): { ipAddress: string | null; userAgent: string | null } {
  const xf = req.headers?.["x-forwarded-for"];
  const forwarded =
    typeof xf === "string" ? xf.split(",")[0]?.trim() : Array.isArray(xf) ? xf[0] : undefined;
  const ip = (typeof req.ip === "string" && req.ip) || forwarded || null;
  const ua = req.headers?.["user-agent"];
  return {
    ipAddress: ip,
    userAgent: typeof ua === "string" ? ua : null,
  };
}

/**
 * Append-only audit event. Never throws to callers — failures are logged only.
 */
export async function logAuditEvent(params: {
  userId: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
  req?: any;
}): Promise<void> {
  const { ipAddress, userAgent } = params.req ? getRequestMeta(params.req) : { ipAddress: null, userAgent: null };
  try {
    await storage.insertAuditEvent({
      userId: params.userId,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId ?? null,
      metadata: params.metadata ?? null,
      ipAddress,
      userAgent,
    });
  } catch (e) {
    console.error("[audit] insertAuditEvent failed:", e);
  }
}
