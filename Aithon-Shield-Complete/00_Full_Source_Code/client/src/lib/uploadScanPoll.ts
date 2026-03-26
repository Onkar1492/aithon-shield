import { apiRequest } from "@/lib/queryClient";

export type ScanKind = "mvp" | "mobile" | "web";

export function mapUploadProgress(uploadStatus: string, uploadProgress: string): { pct: number; label: string } {
  if (uploadStatus === "uploaded") return { pct: 100, label: "Upload complete" };
  if (uploadStatus === "failed") return { pct: 0, label: "Upload failed" };
  if (uploadProgress === "connecting") return { pct: 28, label: "Connecting…" };
  if (uploadProgress === "uploading") return { pct: 58, label: "Uploading…" };
  if (uploadProgress === "finalizing") return { pct: 88, label: "Finalizing…" };
  if (uploadStatus === "pending" && uploadProgress === "idle") return { pct: 12, label: "Queued…" };
  return { pct: 15, label: "Processing…" };
}

/** Polls scan row until upload finishes or timeout (matches server upload simulation timing). */
export async function pollScanUploadProgress(
  kind: ScanKind,
  scanId: string,
  onTick: (pct: number, label: string) => void,
  options?: { timeoutMs?: number; intervalMs?: number },
): Promise<"uploaded" | "failed" | "timeout"> {
  const timeoutMs = options?.timeoutMs ?? 20000;
  const intervalMs = options?.intervalMs ?? 400;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const res = await apiRequest("GET", `/api/${kind}-scans/${scanId}`);
    const scan = await res.json();
    const { pct, label } = mapUploadProgress(scan.uploadStatus ?? "none", scan.uploadProgress ?? "idle");
    onTick(pct, label);
    if (scan.uploadStatus === "uploaded") return "uploaded";
    if (scan.uploadStatus === "failed") return "failed";
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return "timeout";
}
