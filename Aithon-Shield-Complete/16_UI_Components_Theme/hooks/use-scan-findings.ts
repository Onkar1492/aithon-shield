import { useQuery } from "@tanstack/react-query";
import type { Finding } from "@shared/schema";

export type ScanType = "mvp" | "mobile" | "web" | "pipeline" | "container" | "network" | "linter";

export function useScanFindings(
  scanType: ScanType | null,
  scanId: string | null,
  enabled: boolean = true
) {
  return useQuery<Finding[]>({
    queryKey: scanType && scanId ? [`/api/${scanType}-scans`, scanId, "findings"] : ['/api/findings'],
    enabled: !!scanType && !!scanId && enabled,
    throwOnError: false,
    staleTime: 30000, // 30 seconds
    placeholderData: [],
  });
}
