import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Shield, Code, Smartphone, Globe, Server, Network, Container, Grid3x3, Map } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { MvpCodeScan, MobileAppScan, WebAppScan, Finding } from "@shared/schema";

interface AssetNode {
  id: string;
  name: string;
  type: 'mvp' | 'mobile' | 'web' | 'api' | 'database' | 'network';
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  totalFindings: number;
}

interface ComponentLayer {
  id: string;
  name: string;
  layer: 'frontend' | 'backend' | 'api' | 'database' | 'mobile' | 'infrastructure';
  findings: Finding[];
  criticalCount: number;
  highCount: number;
  totalFindings: number;
}

interface AttackPath {
  from: string; // component layer id
  to: string;   // component layer id
  severity: 'critical' | 'high' | 'medium';
  description: string;
}

export function RiskMapVisualization() {
  const [viewMode, setViewMode] = useState<'map' | 'grid'>('map');
  
  const { data: mvpScans = [] } = useQuery<MvpCodeScan[]>({
    queryKey: ["/api/mvp-scans"],
  });
  const { data: mobileScans = [] } = useQuery<MobileAppScan[]>({
    queryKey: ["/api/mobile-scans"],
  });
  const { data: webScans = [] } = useQuery<WebAppScan[]>({
    queryKey: ["/api/web-scans"],
  });
  const { data: findings = [] } = useQuery<Finding[]>({
    queryKey: ["/api/findings"],
  });

  const totalScans = mvpScans.length + mobileScans.length + webScans.length;

  // Show empty state for new users
  if (totalScans === 0) {
    return (
      <Card className="p-6 shadow-sm" data-testid="risk-map-visualization">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-primary" />
          Attack Surface Map
        </h3>
        <div className="flex flex-col items-center justify-center h-96 bg-muted/30 rounded-lg text-center">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mb-3 opacity-50" />
          <p className="text-sm text-muted-foreground mb-1">No assets scanned yet</p>
          <p className="text-xs text-muted-foreground max-w-md">
            Your attack surface map will appear here after running security scans on your applications
          </p>
        </div>
      </Card>
    );
  }

  // Group findings by component layers based on their category and asset type
  const categorizeFindings = (finding: Finding): 'frontend' | 'backend' | 'api' | 'database' | 'mobile' | 'infrastructure' => {
    const category = finding.category?.toLowerCase() || '';
    const asset = finding.asset?.toLowerCase() || '';
    
    // Frontend vulnerabilities
    if (category.includes('xss') || category.includes('cross-site') || 
        asset.includes('ui') || asset.includes('client') || asset.includes('react') || asset.includes('angular')) {
      return 'frontend';
    }
    
    // Database vulnerabilities
    if (category.includes('sql') || category.includes('injection') || 
        asset.includes('database') || asset.includes('query')) {
      return 'database';
    }
    
    // API vulnerabilities
    if (category.includes('api') || category.includes('authentication') || 
        category.includes('authorization') || asset.includes('endpoint') || asset.includes('rest')) {
      return 'api';
    }
    
    // Mobile-specific vulnerabilities
    if (finding.source === 'mobile-scan' || asset.includes('mobile') || asset.includes('ios') || asset.includes('android')) {
      return 'mobile';
    }
    
    // Infrastructure vulnerabilities
    if (category.includes('configuration') || category.includes('network') || 
        asset.includes('server') || asset.includes('infrastructure') || category.includes('headers')) {
      return 'infrastructure';
    }
    
    // Default to backend for everything else
    return 'backend';
  };

  // Build component layers
  const componentLayers: ComponentLayer[] = [
    { id: 'frontend', name: 'Frontend / UI', layer: 'frontend', findings: [], criticalCount: 0, highCount: 0, totalFindings: 0 },
    { id: 'backend', name: 'Backend / Server', layer: 'backend', findings: [], criticalCount: 0, highCount: 0, totalFindings: 0 },
    { id: 'api', name: 'API / Auth', layer: 'api', findings: [], criticalCount: 0, highCount: 0, totalFindings: 0 },
    { id: 'database', name: 'Database', layer: 'database', findings: [], criticalCount: 0, highCount: 0, totalFindings: 0 },
    { id: 'mobile', name: 'Mobile App', layer: 'mobile', findings: [], criticalCount: 0, highCount: 0, totalFindings: 0 },
    { id: 'infrastructure', name: 'Infrastructure', layer: 'infrastructure', findings: [], criticalCount: 0, highCount: 0, totalFindings: 0 },
  ];

  // Categorize all findings into layers
  findings.forEach(finding => {
    const layer = categorizeFindings(finding);
    const componentLayer = componentLayers.find(cl => cl.layer === layer);
    if (componentLayer) {
      componentLayer.findings.push(finding);
      componentLayer.totalFindings++;
      if (finding.severity === 'CRITICAL') componentLayer.criticalCount++;
      if (finding.severity === 'HIGH') componentLayer.highCount++;
    }
  });

  // Filter out empty layers
  const activeLayers = componentLayers.filter(cl => cl.totalFindings > 0);

  // Define attack paths based on vulnerability types
  const attackPaths: AttackPath[] = [];
  
  // Frontend XSS -> Backend exploitation
  const frontendLayer = activeLayers.find(l => l.layer === 'frontend');
  const backendLayer = activeLayers.find(l => l.layer === 'backend');
  if (frontendLayer && backendLayer && frontendLayer.findings.some(f => f.category?.toLowerCase().includes('xss'))) {
    attackPaths.push({
      from: 'frontend',
      to: 'backend',
      severity: 'high',
      description: 'XSS can be used to steal credentials and attack backend'
    });
  }

  // API auth issues -> Database access
  const apiLayer = activeLayers.find(l => l.layer === 'api');
  const dbLayer = activeLayers.find(l => l.layer === 'database');
  if (apiLayer && dbLayer && apiLayer.findings.some(f => 
    f.category?.toLowerCase().includes('auth') || f.category?.toLowerCase().includes('access'))) {
    attackPaths.push({
      from: 'api',
      to: 'database',
      severity: 'critical',
      description: 'Broken authentication can lead to unauthorized database access'
    });
  }

  // SQL Injection -> Database compromise
  if (dbLayer && dbLayer.findings.some(f => f.category?.toLowerCase().includes('sql'))) {
    attackPaths.push({
      from: 'backend',
      to: 'database',
      severity: 'critical',
      description: 'SQL injection provides direct database access'
    });
  }

  // Infrastructure misconfig -> All systems
  const infraLayer = activeLayers.find(l => l.layer === 'infrastructure');
  if (infraLayer && infraLayer.criticalCount > 0) {
    activeLayers.filter(l => l.layer !== 'infrastructure').forEach(layer => {
      attackPaths.push({
        from: 'infrastructure',
        to: layer.id,
        severity: 'high',
        description: 'Infrastructure vulnerabilities expose all application layers'
      });
    });
  }

  // Mobile -> API -> Backend chain
  const mobileLayer = activeLayers.find(l => l.layer === 'mobile');
  if (mobileLayer && apiLayer) {
    attackPaths.push({
      from: 'mobile',
      to: 'api',
      severity: mobileLayer.criticalCount > 0 ? 'critical' : 'high',
      description: 'Mobile app vulnerabilities can compromise API security'
    });
  }
  if (apiLayer && backendLayer) {
    attackPaths.push({
      from: 'api',
      to: 'backend',
      severity: apiLayer.criticalCount > 0 ? 'critical' : 'high',
      description: 'API vulnerabilities provide backend access'
    });
  }

  // Build asset nodes from scans and findings (for grid view)
  const assetNodes: AssetNode[] = [];
  
  mvpScans.forEach(scan => {
    assetNodes.push({
      id: scan.id,
      name: scan.projectName,
      type: 'mvp',
      criticalCount: scan.criticalCount || 0,
      highCount: scan.highCount || 0,
      mediumCount: scan.mediumCount || 0,
      lowCount: scan.lowCount || 0,
      totalFindings: scan.findingsCount || 0,
    });
  });

  mobileScans.forEach(scan => {
    assetNodes.push({
      id: scan.id,
      name: scan.appName,
      type: 'mobile',
      criticalCount: scan.criticalCount || 0,
      highCount: scan.highCount || 0,
      mediumCount: scan.mediumCount || 0,
      lowCount: scan.lowCount || 0,
      totalFindings: scan.findingsCount || 0,
    });
  });

  webScans.forEach(scan => {
    assetNodes.push({
      id: scan.id,
      name: scan.appName,
      type: 'web',
      criticalCount: scan.criticalCount || 0,
      highCount: scan.highCount || 0,
      mediumCount: scan.mediumCount || 0,
      lowCount: scan.lowCount || 0,
      totalFindings: scan.findingsCount || 0,
    });
  });

  const getAssetIcon = (type: string) => {
    switch (type) {
      case 'mvp': return Code;
      case 'mobile': return Smartphone;
      case 'web': return Globe;
      case 'api': return Server;
      case 'database': return Server;
      case 'network': return Network;
      default: return Shield;
    }
  };

  const getRiskLevel = (criticalCount: number, highCount: number) => {
    if (criticalCount > 0) return { level: 'Critical', color: 'destructive' as const };
    if (highCount > 2) return { level: 'High', color: 'default' as const };
    if (highCount > 0) return { level: 'Medium', color: 'secondary' as const };
    return { level: 'Low', color: 'outline' as const };
  };

  // For users with scans, show enhanced visualization
  return (
    <Card className="p-6 shadow-sm" data-testid="risk-map-visualization">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-primary" />
          Attack Surface Map
        </h3>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'map' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('map')}
            data-testid="button-view-map"
          >
            <Map className="h-4 w-4 mr-2" />
            Map View
          </Button>
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
            data-testid="button-view-grid"
          >
            <Grid3x3 className="h-4 w-4 mr-2" />
            Grid View
          </Button>
        </div>
      </div>
      <div className="bg-muted/30 rounded-lg p-6">
        {assetNodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mb-3 opacity-50" />
            <p className="text-sm text-muted-foreground mb-1">No findings data available</p>
            <p className="text-xs text-muted-foreground max-w-md">
              Run security scans to populate your attack surface map
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div className="bg-background rounded-lg p-3 border">
                <div className="text-2xl font-bold text-primary">
                  {assetNodes.length}
                </div>
                <div className="text-xs text-muted-foreground">Assets Scanned</div>
              </div>
              <div className="bg-background rounded-lg p-3 border">
                <div className="text-2xl font-bold text-destructive">
                  {assetNodes.reduce((sum, node) => sum + node.criticalCount, 0)}
                </div>
                <div className="text-xs text-muted-foreground">Critical Issues</div>
              </div>
              <div className="bg-background rounded-lg p-3 border">
                <div className="text-2xl font-bold">
                  {assetNodes.reduce((sum, node) => sum + node.highCount, 0)}
                </div>
                <div className="text-xs text-muted-foreground">High Issues</div>
              </div>
              <div className="bg-background rounded-lg p-3 border">
                <div className="text-2xl font-bold text-primary">
                  {assetNodes.reduce((sum, node) => sum + node.totalFindings, 0)}
                </div>
                <div className="text-xs text-muted-foreground">Total Findings</div>
              </div>
            </div>

            {/* Network Map Visualization */}
            {viewMode === 'map' ? (
              <div className="relative bg-background rounded-lg border p-6 min-h-[600px]" data-testid="network-map">
                <svg width="100%" height="600" className="overflow-visible">
                  <defs>
                    <marker id="arrowhead-critical" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
                      <polygon points="0 0, 10 3, 0 6" fill="rgb(239, 68, 68)" />
                    </marker>
                    <marker id="arrowhead-high" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
                      <polygon points="0 0, 10 3, 0 6" fill="rgb(251, 146, 60)" />
                    </marker>
                    <marker id="arrowhead-medium" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
                      <polygon points="0 0, 10 3, 0 6" fill="rgb(234, 179, 8)" />
                    </marker>
                  </defs>
                  
                  {/* Draw attack paths */}
                  {attackPaths.map((path, idx) => {
                    // Define layer positions
                    const layerPositions: Record<string, {x: number, y: number}> = {
                      'frontend': { x: 150, y: 100 },
                      'mobile': { x: 550, y: 100 },
                      'api': { x: 350, y: 250 },
                      'backend': { x: 150, y: 400 },
                      'database': { x: 550, y: 400 },
                      'infrastructure': { x: 350, y: 500 },
                    };
                    
                    const fromPos = layerPositions[path.from];
                    const toPos = layerPositions[path.to];
                    
                    if (!fromPos || !toPos) return null;
                    
                    const pathColor = 
                      path.severity === 'critical' ? 'rgb(239, 68, 68)' :
                      path.severity === 'high' ? 'rgb(251, 146, 60)' :
                      'rgb(234, 179, 8)';
                    
                    const marker = 
                      path.severity === 'critical' ? 'arrowhead-critical' :
                      path.severity === 'high' ? 'arrowhead-high' :
                      'arrowhead-medium';
                    
                    return (
                      <g key={`path-${idx}`}>
                        <line
                          x1={fromPos.x}
                          y1={fromPos.y}
                          x2={toPos.x}
                          y2={toPos.y}
                          stroke={pathColor}
                          strokeWidth="3"
                          strokeDasharray="8,4"
                          opacity="0.6"
                          markerEnd={`url(#${marker})`}
                        />
                        {/* Attack path label */}
                        <text
                          x={(fromPos.x + toPos.x) / 2}
                          y={(fromPos.y + toPos.y) / 2 - 10}
                          textAnchor="middle"
                          className="text-[10px] font-medium fill-foreground"
                          opacity="0.7"
                        >
                          {path.severity.toUpperCase()}
                        </text>
                      </g>
                    );
                  })}
                  
                  {/* Draw component layers */}
                  {activeLayers.map((layer) => {
                    const positions: Record<string, {x: number, y: number}> = {
                      'frontend': { x: 150, y: 100 },
                      'mobile': { x: 550, y: 100 },
                      'api': { x: 350, y: 250 },
                      'backend': { x: 150, y: 400 },
                      'database': { x: 550, y: 400 },
                      'infrastructure': { x: 350, y: 500 },
                    };
                    
                    const pos = positions[layer.layer];
                    if (!pos) return null;
                    
                    const layerColor = 
                      layer.criticalCount > 0 ? 'rgb(239, 68, 68)' :
                      layer.highCount > 0 ? 'rgb(251, 146, 60)' :
                      layer.totalFindings > 0 ? 'rgb(234, 179, 8)' :
                      'rgb(34, 197, 94)';
                    
                    return (
                      <g key={layer.id} className="cursor-pointer hover:opacity-90 transition-opacity">
                        {/* Glow for critical/high */}
                        {layer.criticalCount > 0 && (
                          <circle
                            cx={pos.x}
                            cy={pos.y}
                            r="65"
                            fill="rgb(239, 68, 68)"
                            opacity="0.15"
                          />
                        )}
                        
                        {/* Main layer box */}
                        <rect
                          x={pos.x - 60}
                          y={pos.y - 40}
                          width="120"
                          height="80"
                          rx="8"
                          fill="hsl(var(--background))"
                          stroke={layerColor}
                          strokeWidth="3"
                        />
                        
                        {/* Layer icon indicator */}
                        <circle
                          cx={pos.x}
                          cy={pos.y - 15}
                          r="12"
                          fill={layerColor}
                          opacity="0.2"
                        />
                        
                        {/* Layer name */}
                        <text
                          x={pos.x}
                          y={pos.y - 10}
                          textAnchor="middle"
                          className="text-xs font-bold fill-foreground"
                        >
                          {layer.name}
                        </text>
                        
                        {/* Findings count */}
                        <text
                          x={pos.x}
                          y={pos.y + 10}
                          textAnchor="middle"
                          className="text-sm font-bold"
                          fill={layerColor}
                        >
                          {layer.totalFindings} issues
                        </text>
                        
                        {/* Critical/High badge */}
                        {(layer.criticalCount > 0 || layer.highCount > 0) && (
                          <g>
                            <circle
                              cx={pos.x + 50}
                              cy={pos.y - 30}
                              r="18"
                              fill={layer.criticalCount > 0 ? 'rgb(239, 68, 68)' : 'rgb(251, 146, 60)'}
                            />
                            <text
                              x={pos.x + 50}
                              y={pos.y - 24}
                              textAnchor="middle"
                              className="text-xs font-bold fill-white"
                            >
                              {layer.criticalCount > 0 ? layer.criticalCount : layer.highCount}
                            </text>
                            <text
                              x={pos.x + 50}
                              y={pos.y - 14}
                              textAnchor="middle"
                              className="text-[8px] font-bold fill-white"
                            >
                              {layer.criticalCount > 0 ? 'CRIT' : 'HIGH'}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}
                </svg>
                
                {/* Legend */}
                <div className="absolute bottom-4 left-4 bg-background/95 border rounded-lg p-3 text-xs space-y-2">
                  <div className="font-semibold mb-2">Legend</div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-0.5 bg-red-500" />
                      <span>Critical Attack Path</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-0.5 bg-orange-500" />
                      <span>High Attack Path</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-0.5 bg-yellow-500" />
                      <span>Medium Attack Path</span>
                    </div>
                  </div>
                  <div className="border-t pt-2 mt-2 text-[10px] text-muted-foreground">
                    Arrows show how vulnerabilities can be chained across layers
                  </div>
                </div>
                
                {/* Info panel */}
                <div className="absolute top-4 right-4 bg-background/95 border rounded-lg p-3 text-xs max-w-xs">
                  <div className="font-semibold mb-1">Attack Surface Analysis</div>
                  <div className="text-muted-foreground text-[10px]">
                    This map shows how security issues in different components can be exploited together. 
                    Each box represents a layer of your application with its vulnerability count.
                  </div>
                </div>
              </div>
            ) : (
              /* Grid View - Asset Cards */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {assetNodes.map(asset => {
                  const Icon = getAssetIcon(asset.type);
                  const risk = getRiskLevel(asset.criticalCount, asset.highCount);
                  
                  return (
                    <Card 
                      key={asset.id} 
                      className="p-4 hover-elevate cursor-pointer transition-all"
                      data-testid={`asset-node-${asset.id}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium text-sm">{asset.name}</div>
                            <div className="text-xs text-muted-foreground capitalize">{asset.type}</div>
                          </div>
                        </div>
                        <Badge variant={risk.color} className="text-xs">
                          {risk.level}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {asset.criticalCount > 0 && (
                          <div className="flex items-center justify-between bg-destructive/10 rounded px-2 py-1">
                            <span className="text-muted-foreground">Critical</span>
                            <span className="font-semibold text-destructive">{asset.criticalCount}</span>
                          </div>
                        )}
                        {asset.highCount > 0 && (
                          <div className="flex items-center justify-between bg-muted rounded px-2 py-1">
                            <span className="text-muted-foreground">High</span>
                            <span className="font-semibold">{asset.highCount}</span>
                          </div>
                        )}
                        {asset.mediumCount > 0 && (
                          <div className="flex items-center justify-between bg-muted/50 rounded px-2 py-1">
                            <span className="text-muted-foreground">Medium</span>
                            <span className="font-semibold">{asset.mediumCount}</span>
                          </div>
                        )}
                        {asset.lowCount > 0 && (
                          <div className="flex items-center justify-between bg-muted/30 rounded px-2 py-1">
                            <span className="text-muted-foreground">Low</span>
                            <span className="font-semibold">{asset.lowCount}</span>
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
