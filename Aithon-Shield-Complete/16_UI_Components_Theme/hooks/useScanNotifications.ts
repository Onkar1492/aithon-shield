import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import type { MobileAppScan, MvpCodeScan, WebAppScan } from "@shared/schema";

const SESSION_SCANS_KEY = "aegis_session_scans";

interface SessionScan {
  id: string;
  type: "mvp" | "mobile" | "web";
  name: string;
  createdAt: number;
}

// Utility functions to manage session scans
export function addSessionScan(id: string, type: "mvp" | "mobile" | "web", name: string) {
  const scans = getSessionScans();
  scans.push({ id, type, name, createdAt: Date.now() });
  localStorage.setItem(SESSION_SCANS_KEY, JSON.stringify(scans));
}

function getSessionScans(): SessionScan[] {
  try {
    const stored = localStorage.getItem(SESSION_SCANS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function removeSessionScan(id: string) {
  const scans = getSessionScans();
  const filtered = scans.filter(scan => scan.id !== id);
  localStorage.setItem(SESSION_SCANS_KEY, JSON.stringify(filtered));
}

export function useScanNotifications() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const notifiedScans = useRef(new Set<string>());

  // Fetch all scans
  const { data: mvpScans = [] } = useQuery<MvpCodeScan[]>({
    queryKey: ["/api/mvp-scans"],
    refetchInterval: 2000,
  });

  const { data: mobileScans = [] } = useQuery<MobileAppScan[]>({
    queryKey: ["/api/mobile-scans"],
    refetchInterval: 2000,
  });

  const { data: webScans = [] } = useQuery<WebAppScan[]>({
    queryKey: ["/api/web-scans"],
    refetchInterval: 2000,
  });

  useEffect(() => {
    const sessionScans = getSessionScans();
    
    // Check each session scan for completion
    sessionScans.forEach(sessionScan => {
      // Skip if already notified
      if (notifiedScans.current.has(sessionScan.id)) {
        return;
      }

      let scan: MvpCodeScan | MobileAppScan | WebAppScan | undefined;
      
      if (sessionScan.type === "mvp") {
        scan = mvpScans.find(s => s.id === sessionScan.id);
      } else if (sessionScan.type === "mobile") {
        scan = mobileScans.find(s => s.id === sessionScan.id);
      } else if (sessionScan.type === "web") {
        scan = webScans.find(s => s.id === sessionScan.id);
      }

      // If scan is completed, show notification
      if (scan && scan.scanStatus === "completed") {
        const scanTypeLabel = sessionScan.type === "mvp" 
          ? "MVP Code Scan" 
          : sessionScan.type === "mobile" 
          ? "Mobile App Scan" 
          : "Web App Scan";

        const findingsCount = scan.findingsCount || 0;
        const criticalCount = scan.criticalCount || 0;

        toast({
          title: `${scanTypeLabel} Complete`,
          description: `${sessionScan.name} - Found ${findingsCount} issue${findingsCount !== 1 ? 's' : ''}${criticalCount > 0 ? ` (${criticalCount} critical)` : ''}. Click to view details.`,
          duration: 8000,
          action: {
            label: "View Scan",
            onClick: () => setLocation(`/scan-details/${sessionScan.type}/${sessionScan.id}`)
          }
        });

        // Mark as notified and remove from session tracking
        notifiedScans.current.add(sessionScan.id);
        removeSessionScan(sessionScan.id);
      }
    });
  }, [mvpScans, mobileScans, webScans, toast, setLocation]);
}
