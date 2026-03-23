import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Code, Smartphone, Globe, Shield, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import type { MvpCodeScan, MobileAppScan, WebAppScan } from "@shared/schema";
import { useLocation } from "wouter";

type AllScan = {
  id: string;
  type: "mvp" | "mobile" | "web";
  name: string;
  platform?: string;
  status: string;
  findingsCount: number;
  criticalCount: number;
  highCount: number;
  createdAt: Date;
  scannedAt?: Date | null;
};

export default function AllScans() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "mvp" | "mobile" | "web">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "completed" | "scanning" | "pending">("all");

  const { data: mvpScans = [] } = useQuery<MvpCodeScan[]>({
    queryKey: ["/api/mvp-scans"],
    refetchInterval: 3000, // Refresh every 3 seconds to catch scanning updates
  });

  const { data: mobileScans = [] } = useQuery<MobileAppScan[]>({
    queryKey: ["/api/mobile-scans"],
    refetchInterval: 3000,
  });

  const { data: webScans = [] } = useQuery<WebAppScan[]>({
    queryKey: ["/api/web-scans"],
    refetchInterval: 3000,
  });

  const allScans: AllScan[] = [
    ...mvpScans.map((scan) => ({
      id: scan.id,
      type: "mvp" as const,
      name: scan.projectName,
      platform: scan.platform,
      status: scan.scanStatus,
      findingsCount: scan.findingsCount,
      criticalCount: scan.criticalCount,
      highCount: scan.highCount,
      createdAt: scan.createdAt,
      scannedAt: scan.scannedAt,
    })),
    ...mobileScans.map((scan) => ({
      id: scan.id,
      type: "mobile" as const,
      name: scan.appName,
      platform: scan.platform,
      status: scan.scanStatus,
      findingsCount: scan.findingsCount,
      criticalCount: scan.criticalCount,
      highCount: scan.highCount,
      createdAt: scan.createdAt,
      scannedAt: scan.scannedAt,
    })),
    ...webScans.map((scan) => ({
      id: scan.id,
      type: "web" as const,
      name: scan.appName,
      platform: scan.appUrl,
      status: scan.scanStatus,
      findingsCount: scan.findingsCount,
      criticalCount: scan.criticalCount,
      highCount: scan.highCount,
      createdAt: scan.createdAt,
      scannedAt: scan.scannedAt,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const filteredScans = allScans.filter((scan) => {
    const matchesType = filterType === "all" || scan.type === filterType;
    const matchesStatus = filterStatus === "all" || scan.status === filterStatus;
    const matchesSearch = scan.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (scan.platform && scan.platform.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesType && matchesStatus && matchesSearch;
  });

  const getScanTypeIcon = (type: string) => {
    switch (type) {
      case "mvp":
        return <Code className="h-4 w-4" />;
      case "mobile":
        return <Smartphone className="h-4 w-4" />;
      case "web":
        return <Globe className="h-4 w-4" />;
      default:
        return <Shield className="h-4 w-4" />;
    }
  };

  const getScanTypeLabel = (type: string) => {
    switch (type) {
      case "mvp":
        return "MVP Code";
      case "mobile":
        return "Mobile App";
      case "web":
        return "Web App";
      default:
        return type;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="default" className="gap-1" data-testid={`badge-status-completed`}>
            <CheckCircle2 className="h-3 w-3" />
            Completed
          </Badge>
        );
      case "scanning":
        return (
          <Badge variant="secondary" className="gap-1" data-testid={`badge-status-scanning`}>
            <Clock className="h-3 w-3 animate-spin" />
            Scanning
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="outline" className="gap-1" data-testid={`badge-status-pending`}>
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive" className="gap-1" data-testid={`badge-status-failed`}>
            <AlertCircle className="h-3 w-3" />
            Failed
          </Badge>
        );
      default:
        return <Badge variant="outline" data-testid={`badge-status-${status}`}>{status}</Badge>;
    }
  };

  const navigateToScan = (scan: AllScan) => {
    switch (scan.type) {
      case "mvp":
        setLocation("/mvp-code-scan");
        break;
      case "mobile":
        setLocation("/mobile-app-scan");
        break;
      case "web":
        setLocation("/web-app-scan");
        break;
    }
  };

  const getStatusCount = (status: string) => {
    return allScans.filter((scan) => scan.status === status).length;
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold" data-testid="heading-all-scans">All Scans</h1>
        <p className="text-muted-foreground mt-1 md:mt-2 text-sm md:text-base" data-testid="text-all-scans-description">
          View and manage all your security scans in one place
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card 
          className="hover-elevate active-elevate-2 cursor-pointer" 
          onClick={() => setFilterStatus("all")}
          data-testid="card-total-scans"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Scans</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-scans">{allScans.length}</div>
          </CardContent>
        </Card>

        <Card 
          className="hover-elevate active-elevate-2 cursor-pointer" 
          onClick={() => setFilterStatus("completed")}
          data-testid="card-completed-scans"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500" data-testid="text-completed-scans">
              {getStatusCount("completed")}
            </div>
          </CardContent>
        </Card>

        <Card 
          className="hover-elevate active-elevate-2 cursor-pointer" 
          onClick={() => setFilterStatus("scanning")}
          data-testid="card-scanning-scans"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scanning</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500" data-testid="text-scanning-scans">
              {getStatusCount("scanning")}
            </div>
          </CardContent>
        </Card>

        <Card 
          className="hover-elevate active-elevate-2 cursor-pointer" 
          onClick={() => setFilterStatus("pending")}
          data-testid="card-pending-scans"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500" data-testid="text-pending-scans">
              {getStatusCount("pending")}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-scans-list">
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search scans by name or platform..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-scans"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={filterType} onValueChange={(v) => setFilterType(v as any)} data-testid="tabs-scan-type">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all" data-testid="tab-all">
                All ({allScans.length})
              </TabsTrigger>
              <TabsTrigger value="mvp" data-testid="tab-mvp">
                MVP ({mvpScans.length})
              </TabsTrigger>
              <TabsTrigger value="mobile" data-testid="tab-mobile">
                Mobile ({mobileScans.length})
              </TabsTrigger>
              <TabsTrigger value="web" data-testid="tab-web">
                Web ({webScans.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={filterType} className="mt-6 space-y-3">
              {filteredScans.length === 0 ? (
                <div className="text-center py-12" data-testid="empty-state">
                  <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No scans found</p>
                </div>
              ) : (
                filteredScans.map((scan) => (
                  <div
                    key={scan.id}
                    onClick={() => navigateToScan(scan)}
                    className="flex items-center justify-between p-4 rounded-lg border hover-elevate active-elevate-2 cursor-pointer"
                    data-testid={`scan-item-${scan.id}`}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="p-2 bg-accent rounded-lg">
                        {getScanTypeIcon(scan.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium truncate" data-testid={`text-scan-name-${scan.id}`}>
                            {scan.name}
                          </p>
                          <Badge variant="outline" className="shrink-0" data-testid={`badge-scan-type-${scan.id}`}>
                            {getScanTypeLabel(scan.type)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate" data-testid={`text-scan-platform-${scan.id}`}>
                          {scan.platform}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {scan.status === "completed" && (
                        <div className="flex items-center gap-2" data-testid={`findings-${scan.id}`}>
                          <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">
                            {scan.criticalCount}
                          </Badge>
                          <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/20">
                            {scan.highCount}
                          </Badge>
                        </div>
                      )}
                      {getStatusBadge(scan.status)}
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
